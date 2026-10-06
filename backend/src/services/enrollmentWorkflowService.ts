import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { googleClassroomService } from './googleClassroomService.js';
import { logger } from '../utils/logger.js';
import { LeadRecord, ClassroomEnrollmentRecord } from '../types/index.js';

export class EnrollmentWorkflowService {
  /**
   * Authoritative handler when Razorpay payment is confirmed (via Webhook or Verify fast-path)
   */
  async handlePaymentSuccess(
    orderId: string,
    paymentId: string,
    paidAt: Date = new Date()
  ): Promise<void> {
    logger.info('Processing authoritative payment success', { orderId, paymentId });

    // Step 1: Update payment and lead in an atomic transaction
    const lead = await withTransaction(async (client) => {
      // Find existing payment
      const paymentRes = await client.query(
        `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
        [orderId]
      );

      if (paymentRes.rows.length === 0) {
        throw new Error(`Payment record not found for order: ${orderId}`);
      }

      const payment = paymentRes.rows[0];

      // Update payment record
      await client.query(
        `UPDATE payments
         SET status = 'PAID', razorpay_payment_id = $1, paid_at = $2, updated_at = NOW()
         WHERE razorpay_order_id = $3`,
        [paymentId, paidAt, orderId]
      );

      // Update lead record
      const leadRes = await client.query<LeadRecord>(
        `UPDATE leads
         SET payment_status = 'PAID', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [payment.lead_id]
      );

      const updatedLead = leadRes.rows[0];

      // Upsert classroom enrollment record
      await client.query(
        `INSERT INTO classroom_enrollments (lead_id, course_id, google_email, status)
         VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (lead_id, course_id)
         DO UPDATE SET updated_at = NOW()`,
        [
          updatedLead.id,
          env.GOOGLE_CLASSROOM_COURSE_ID,
          updatedLead.email_normalized,
        ]
      );

      return updatedLead;
    });

    // Step 2: Trigger Google Classroom enrollment outside the DB transaction
    await this.executeEnrollment(lead);
  }

  /**
   * Execute Google Classroom enrollment with diagnostics and retry tracking
   */
  async executeEnrollment(lead: LeadRecord, isRetry: boolean = false): Promise<void> {
    const courseId = env.GOOGLE_CLASSROOM_COURSE_ID;

    // Get current enrollment record FOR UPDATE to prevent race conditions
    const enrollmentRes = await withTransaction(async (client) => {
       return client.query<ClassroomEnrollmentRecord>(
        `SELECT * FROM classroom_enrollments WHERE lead_id = $1 AND course_id = $2 FOR UPDATE`,
        [lead.id, courseId]
       );
    });

    if (enrollmentRes.rows.length === 0) return;
    const enrollment = enrollmentRes.rows[0];

    // Already enrolled
    if (enrollment.status === 'ENROLLED') {
      logger.info('Student already marked as enrolled', {
        leadId: lead.id,
        email: lead.email_normalized,
      });
      return;
    }

    const attemptNumber = enrollment.attempt_count + 1;

    // Call external Google Classroom API
    const result = await googleClassroomService.enrollStudent(
      lead.id,
      lead.email_normalized,
      courseId
    );

    // Record attempt diagnostic log
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

    if (result.success && result.status === 'ENROLLED') {
      // Mark enrollment as ENROLLED
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
        [courseId, result.googleUserId || null, lead.id]
      );

      logger.info('Classroom enrollment completed successfully', {
        leadId: lead.id,
        email: lead.email_normalized,
      });
    } else {
      // Failed attempt
      const isTransient = result.isTransient;
      const willRetry = isTransient && attemptNumber < 5;

      await query(
        `UPDATE classroom_enrollments
         SET status = $1,
             attempt_count = $2,
             last_error_code = $3,
             last_error_message = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          willRetry ? 'PENDING' : 'FAILED',
          attemptNumber,
          result.errorCode || 'UNKNOWN',
          result.errorMessage || 'Enrollment error',
          enrollment.id,
        ]
      );

      await query(
        `UPDATE leads
         SET enrollment_status = $1, updated_at = NOW()
         WHERE id = $2`,
        [willRetry ? 'PENDING' : 'FAILED', lead.id]
      );

      // If retryable, and not already running from a retry job, schedule job
      if (willRetry && !isRetry) {
        const backoffSeconds = Math.pow(2, attemptNumber) * 5; // 10s, 20s, 40s, 80s
        
        // Ensure no pending job exists before inserting to prevent duplicate queueing
        const existingJob = await query(
          `SELECT id FROM enrollment_jobs WHERE enrollment_id = $1 AND action = 'ENROLL' AND status IN ('PENDING', 'PROCESSING')`,
          [enrollment.id]
        );
        
        if (existingJob.rows.length === 0) {
          await query(
            `INSERT INTO enrollment_jobs (enrollment_id, action, status, next_run_at, attempts, last_error)
             VALUES ($1, 'ENROLL', 'PENDING', NOW() + ($2 || ' seconds')::INTERVAL, $3, $4)`,
            [enrollment.id, backoffSeconds, attemptNumber, result.errorMessage]
          );

          logger.warn('Classroom enrollment scheduled for retry', {
            leadId: lead.id,
            attempt: String(attemptNumber),
            backoffSeconds: String(backoffSeconds),
          });
        }
      } else if (!willRetry) {
        logger.error('Classroom enrollment permanently failed or max retries reached', null, {
          leadId: lead.id,
          errorCode: result.errorCode,
        });
      }
    }
  }

  /**
   * Handle refund event: mark payment refunded and revoke Google Classroom access
   */
  async handleRefund(orderId?: string, paymentId?: string): Promise<void> {
    logger.info('Processing refund event', { orderId, paymentId });

    const lookupRes = await query(
      `SELECT p.id as payment_id, p.lead_id, l.email_normalized, ce.id as enrollment_id, ce.google_user_id, ce.invitation_id
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

    // Atomically transition payment and enrollment status to REFUNDED / REMOVAL_PENDING
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE payments SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
        [item.payment_id]
      );

      await client.query(
        `UPDATE leads SET payment_status = 'REFUNDED', enrollment_status = 'REMOVAL_PENDING', updated_at = NOW() WHERE id = $1`,
        [item.lead_id]
      );

      if (item.enrollment_id) {
        await client.query(
          `UPDATE classroom_enrollments SET status = 'REMOVAL_PENDING', updated_at = NOW() WHERE id = $1`,
          [item.enrollment_id]
        );
      }
    });

    // Execute student removal from Google Classroom
    const removalResult = await googleClassroomService.removeStudent(
      item.lead_id,
      item.email_normalized,
      item.google_user_id,
      item.invitation_id
    );

    if (removalResult.success) {
      await query(
        `UPDATE classroom_enrollments SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [item.enrollment_id]
      );
      await query(
        `UPDATE leads SET enrollment_status = 'REMOVED', updated_at = NOW() WHERE id = $1`,
        [item.lead_id]
      );
      logger.info('Student access successfully revoked following refund', {
        leadId: item.lead_id,
      });
    } else {
      logger.error('Failed to revoke student access from Classroom', null, {
        leadId: item.lead_id,
        errorCode: removalResult.errorCode,
      });
    }
  }
}

export const enrollmentWorkflowService = new EnrollmentWorkflowService();
