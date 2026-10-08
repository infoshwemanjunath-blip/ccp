import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { googleClassroomService } from './googleClassroomService.js';
import { emailService } from './emailService.js';
import { razorpayService } from './razorpayService.js';
import { logger } from '../utils/logger.js';
import { LeadRecord, ClassroomEnrollmentRecord } from '../types/index.js';

export class EnrollmentWorkflowService {
  /**
   * Authoritative handler when Razorpay payment is confirmed (via Webhook or Verify fast-path)
   */
  async handlePaymentSuccess(
    orderId: string,
    paymentId: string,
    paidAt: Date = new Date(),
    fallbackEmail?: string,
    fallbackName?: string
  ): Promise<{ transitioned: boolean }> {
    logger.info('Processing authoritative payment success', { orderId, paymentId });

    let retries = 3;
    while (retries > 0) {
      try {
        const result = await withTransaction(async (client) => {
          // Setting lock timeout so we don't hang indefinitely (2000ms)
          await client.query('SET LOCAL lock_timeout = 2000');

          // 1. Get payment_id and lead_id FIRST without locking to know what to lock
          const lookupRes = await client.query(
            `SELECT id, lead_id FROM payments WHERE razorpay_order_id = $1`,
            [orderId]
          );

          if (lookupRes.rows.length === 0) {
            throw new Error(`Payment record not found for order: ${orderId}`);
          }
          
          const internalPaymentId = lookupRes.rows[0].id;
          const leadId = lookupRes.rows[0].lead_id;

          // 2. Lock leads
          const leadRes = await client.query<LeadRecord>(
            `SELECT * FROM leads WHERE id = $1 FOR UPDATE`,
            [leadId]
          );
          if (leadRes.rows.length === 0) throw new Error('Lead not found');
          const lead = leadRes.rows[0];

          // 3. Lock payments
          const paymentRes = await client.query(
            `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
            [internalPaymentId]
          );
          const payment = paymentRes.rows[0];

          // Idempotency / State machine check
          if (payment.status === 'PAID') {
            logger.info('Payment already marked as PAID, skipping duplicate processing', { orderId, paymentId, leadId });
            return { transitioned: false };
          }
          if (payment.status === 'REFUNDED' || payment.status === 'FAILED') {
            logger.error(`Invalid state transition: Cannot move payment from ${payment.status} to PAID`, { orderId, paymentId });
            return { transitioned: false };
          }

          // 4. Update payment record
          await client.query(
            `UPDATE payments
             SET status = 'PAID', razorpay_payment_id = $1, paid_at = $2, updated_at = NOW()
             WHERE id = $3`,
            [paymentId, paidAt, payment.id]
          );

          // 5. Update lead record
          await client.query(
            `UPDATE leads
             SET payment_status = 'PAID', updated_at = NOW()
             WHERE id = $1`,
            [lead.id]
          );

          // 6. Lock and Upsert enrollments record
          await client.query(
            `INSERT INTO enrollments (payment_id, user_id, email, course_id, status)
             VALUES ($1, $2, $3, $4, 'PAID')
             ON CONFLICT (payment_id) DO NOTHING`,
            [
              paymentId,
              lead.id,
              lead.email_normalized,
              env.GOOGLE_CLASSROOM_COURSE_ID,
            ]
          );

          // 7. Lock and Upsert classroom enrollment record
          await client.query(
            `INSERT INTO classroom_enrollments (lead_id, course_id, google_email, status)
             VALUES ($1, $2, $3, 'PENDING')
             ON CONFLICT (lead_id, course_id)
             DO UPDATE SET updated_at = NOW()`,
            [
              lead.id,
              env.GOOGLE_CLASSROOM_COURSE_ID,
              lead.email_normalized,
            ]
          );

          // 8. Insert into outbox_jobs to trigger async side-effects
          if (env.AUTO_CLASSROOM_ENROLLMENT_ENABLED) {
             await client.query(
               `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
                VALUES ($1, 'CLASSROOM_INVITE', $2, 'PENDING')
                ON CONFLICT (payment_id, job_type) DO NOTHING`,
               [
                 payment.id,
                 JSON.stringify({
                   leadId: lead.id,
                   email: lead.email_normalized,
                   fullName: lead.full_name,
                   courseId: env.GOOGLE_CLASSROOM_COURSE_ID,
                   orderId: orderId
                 })
               ]
             );
          }

          return { transitioned: true };
        });

        return result;
      } catch (dbErr: any) {
        // Retry on deadlocks (40P01) or serialization failure (40001)
        if (dbErr.code === '40P01' || dbErr.code === '40001') {
          retries--;
          if (retries === 0) {
            logger.error('Database transaction failed after max retries in handlePaymentSuccess', dbErr, { orderId });
            throw dbErr;
          }
          logger.warn(`Deadlock detected, retrying transaction. Retries left: ${retries}`, { orderId });
          await new Promise(res => setTimeout(res, 50 * (3 - retries)));
        } else {
          logger.error('Database transaction failed in handlePaymentSuccess', dbErr, { orderId });
          throw dbErr;
        }
      }
    }
    return { transitioned: false };
  }

  async enqueueClassroomInvite(lead: LeadRecord, orderId?: string): Promise<void> {
    if (!env.AUTO_CLASSROOM_ENROLLMENT_ENABLED) return;

    try {
      const paymentRes = await query(`SELECT id FROM payments WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`, [lead.id]);
      if (paymentRes.rows.length === 0) return;
      const internalPaymentId = paymentRes.rows[0].id;

      await query(
        `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
         VALUES ($1, 'CLASSROOM_INVITE', $2, 'PENDING')
         ON CONFLICT (payment_id, job_type) DO UPDATE SET status = 'PENDING', attempts = 0, last_error = NULL, next_run_at = NOW()`,
        [
          internalPaymentId,
          JSON.stringify({
            leadId: lead.id,
            email: lead.email_normalized,
            fullName: lead.full_name,
            courseId: env.GOOGLE_CLASSROOM_COURSE_ID,
            orderId
          })
        ]
      );
    } catch (dbErr) {
      logger.error('Failed to enqueue classroom invite', dbErr, { leadId: lead.id });
    }
  }

  /**
   * Outbox worker handler for CLASSROOM_INVITE jobs
   */
  async executeClassroomInvite(payload: any, attemptNumber: number = 1): Promise<{ success: boolean; errorCode?: string; errorMessage?: string; isInvalidEmail?: boolean }> {
    const { leadId, email, courseId, fullName } = payload;

    // Feature flag check
    if (!env.AUTO_CLASSROOM_ENROLLMENT_ENABLED) {
      logger.warn('Classroom enrollment execution skipped: feature flag disabled', { leadId });
      return { success: true };
    }

    // Get current enrollment record FOR UPDATE
    let enrollment: ClassroomEnrollmentRecord | null = null;
    try {
      const enrollmentRes = await withTransaction(async (client) => {
         return client.query<ClassroomEnrollmentRecord>(
          `SELECT * FROM classroom_enrollments WHERE lead_id = $1 AND course_id = $2 FOR UPDATE`,
          [leadId, courseId]
         );
      });
      if (enrollmentRes.rows.length > 0) {
        enrollment = enrollmentRes.rows[0];
      }
    } catch (dbErr) {
      logger.warn('Database error during enrollment check', { leadId });
      return { success: false, errorMessage: 'DB error during lock' };
    }

    if (!enrollment) {
        return { success: false, errorMessage: 'Enrollment record missing' };
    }

    // Already enrolled
    if (enrollment.status === 'ENROLLED' || enrollment.status === 'INVITED') {
      logger.info('Student already marked as enrolled', { leadId, email });
      return { success: true };
    }

    // Call external Google Classroom API
    const result = await googleClassroomService.enrollStudent(
      leadId,
      email,
      courseId
    );

    // Record attempt diagnostic log
    try {
      await query(
        `INSERT INTO enrollment_attempts (enrollment_id, attempt_number, status, error_code, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          enrollment.id,
          attemptNumber,
          result.status,
          result.errorCode || null,
          result.errorMessage || null,
        ]
      );
    } catch (err) { }

    if (result.success && (result.status === 'INVITED' || result.status === 'ENROLLED')) {
      // Mark enrollments table as INVITED
      try {
        await query(
          `UPDATE enrollments
           SET status = 'INVITED', attempts = $1, updated_at = NOW()
           WHERE user_id = $2 AND course_id = $3`,
          [attemptNumber, leadId, courseId]
        );

        await query(
          `UPDATE classroom_enrollments
           SET status = 'ENROLLED',
               google_user_id = $1,
               invitation_id = $2,
               attempt_count = $3,
               enrolled_at = NOW(),
               last_error_code = NULL,
               last_error_message = NULL,
               updated_at = NOW()
           WHERE id = $4`,
          [result.googleUserId || null, result.invitationId || null, attemptNumber, enrollment.id]
        );

        await query(
          `UPDATE leads
           SET enrollment_status = 'ENROLLED',
               google_classroom_course_id = $1,
               google_classroom_user_id = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [courseId, result.googleUserId || null, leadId]
        );
      } catch (dbErr) {
        logger.warn('Could not update DB enrollment status', { leadId });
      }

      logger.info('Classroom enrollment completed successfully (invitation dispatched)', { leadId, email });

      // Insert welcome email into outbox
      try {
        await query(
            `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
             VALUES (
               (SELECT payment_id FROM enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1)::uuid,
               'WELCOME_EMAIL', $3, 'PENDING'
             ) ON CONFLICT DO NOTHING`,
            [
              leadId, courseId,
              JSON.stringify({ toEmail: email, fullName, courseId })
            ]
        );
      } catch (err) {
         logger.warn('Could not insert WELCOME_EMAIL outbox job', { leadId });
      }

      return { success: true };
    } else {
      // Failed attempt
      const isInvalidEmail = Boolean(result.isInvalidEmail);
      const errorCode = isInvalidEmail ? 'INVALID_GOOGLE_EMAIL' : result.errorCode || 'UNKNOWN';

      await query(
        `UPDATE enrollments
         SET status = 'FAILED', attempts = $2, last_error = $3, updated_at = NOW()
         WHERE user_id = $4 AND course_id = $5`,
        [ 'FAILED', attemptNumber, result.errorMessage || errorCode, leadId, courseId ]
      );

      await query(
        `UPDATE classroom_enrollments
         SET status = 'FAILED', attempt_count = $2, last_error_code = $3, last_error_message = $4, updated_at = NOW()
         WHERE id = $5`,
        [ 'FAILED', attemptNumber, errorCode, result.errorMessage || 'Enrollment error', enrollment.id ]
      );

      await query(`UPDATE leads SET enrollment_status = 'FAILED', updated_at = NOW() WHERE id = $1`, [leadId]);

      return {
          success: false,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          isInvalidEmail: result.isInvalidEmail
      };
    }
  }

  /**
   * Handle refund event: mark payment refunded and schedule Google Classroom access revocation
   */
  async handleRefund(orderId?: string, paymentId?: string): Promise<void> {
    logger.info('Processing refund event', { orderId, paymentId });

    try {
        await withTransaction(async (client) => {
          await client.query('SET LOCAL lock_timeout = 2000');
          
          const lookupRes = await client.query(
            `SELECT p.id as payment_id, p.lead_id, l.email_normalized, ce.id as enrollment_id, ce.google_user_id, ce.invitation_id, ce.course_id
             FROM payments p
             JOIN leads l ON p.lead_id = l.id
             LEFT JOIN classroom_enrollments ce ON ce.lead_id = l.id
             WHERE p.razorpay_order_id = $1 OR p.razorpay_payment_id = $2
             LIMIT 1`,
            [orderId || '', paymentId || '']
          );

          if (lookupRes.rows.length === 0) {
            logger.warn('Refund lookup found no matching payment', { orderId, paymentId });
            return;
          }

          const item = lookupRes.rows[0];

          // 1. Lock Leads
          await client.query(`SELECT id FROM leads WHERE id = $1 FOR UPDATE`, [item.lead_id]);
          // 2. Lock Payments
          const paymentRes = await client.query(`SELECT id, status FROM payments WHERE id = $1 FOR UPDATE`, [item.payment_id]);
          const paymentStatus = paymentRes.rows[0].status;

          if (paymentStatus === 'REFUNDED') {
            logger.info('Payment already refunded, skipping duplicate refund processing', { orderId, paymentId });
            return;
          }

          // Update Status
          await client.query(
            `UPDATE payments SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
            [item.payment_id]
          );

          await client.query(
            `UPDATE leads SET payment_status = 'REFUNDED', enrollment_status = 'REMOVAL_PENDING', updated_at = NOW() WHERE id = $1`,
            [item.lead_id]
          );

          await client.query(
            `UPDATE enrollments SET status = 'FAILED', updated_at = NOW() WHERE user_id = $1`,
            [item.lead_id]
          );

          if (item.enrollment_id) {
            await client.query(
              `UPDATE classroom_enrollments SET status = 'REMOVAL_PENDING', updated_at = NOW() WHERE id = $1`,
              [item.enrollment_id]
            );

            // Insert removal job into outbox
            await client.query(
              `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
               VALUES ($1, 'CLASSROOM_REMOVE', $2, 'PENDING')
               ON CONFLICT (payment_id, job_type) DO NOTHING`,
              [
                item.payment_id,
                JSON.stringify({
                   leadId: item.lead_id,
                   email: item.email_normalized,
                   googleUserId: item.google_user_id,
                   invitationId: item.invitation_id,
                   courseId: item.course_id || env.GOOGLE_CLASSROOM_COURSE_ID,
                   enrollmentId: item.enrollment_id
                })
              ]
            );
          }
        });
    } catch (dbErr: any) {
        logger.error('Failed to process refund event transaction', dbErr, { orderId, paymentId });
        throw dbErr;
    }
  }
}

export const enrollmentWorkflowService = new EnrollmentWorkflowService();
