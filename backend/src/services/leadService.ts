import { query, withTransaction } from '../db/pool.js';
import { LeadRecord, EnrollmentStatusResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class LeadService {
  /**
   * Find existing lead by normalized email or create a new lead
   */
  async findOrCreateLead(
    fullName: string,
    phone: string,
    email: string,
    emailNormalized: string
  ): Promise<{ lead: LeadRecord; alreadyEnrolled: boolean }> {
    // Atomic UPSERT using ON CONFLICT (email_normalized)
    const res = await query<LeadRecord>(
      `INSERT INTO leads (full_name, phone, email, email_normalized, payment_status, enrollment_status)
       VALUES ($1, $2, $3, $4, 'PENDING', 'PENDING')
       ON CONFLICT (email_normalized) DO UPDATE 
       SET full_name = CASE WHEN leads.payment_status = 'PAID' THEN leads.full_name ELSE EXCLUDED.full_name END,
           phone = CASE WHEN leads.payment_status = 'PAID' THEN leads.phone ELSE EXCLUDED.phone END,
           email = EXCLUDED.email,
           updated_at = NOW()
       RETURNING *`,
      [fullName, phone, email, emailNormalized]
    );

    if (res.rows.length > 0) {
      const lead = res.rows[0];
      const alreadyEnrolled = lead.payment_status === 'PAID';
      if (alreadyEnrolled) {
        logger.info('Lead already paid', { leadId: lead.id, email: emailNormalized });
      }
      return { lead, alreadyEnrolled };
    }

    throw new Error('Could not find or create lead');
  }

  async updateLatestOrder(leadId: string, orderId: string): Promise<void> {
    await query(
      `UPDATE leads SET latest_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [orderId, leadId]
    );
  }

  async getStatusByOrderId(orderId: string): Promise<EnrollmentStatusResponse | null> {
    const result = await query(
      `SELECT 
         l.id as lead_id,
         l.email_normalized,
         l.payment_status, 
         l.enrollment_status,
         ce.status as classroom_status,
         ce.last_error_code,
         ce.course_id
       FROM payments p
       JOIN leads l ON p.lead_id = l.id
       LEFT JOIN classroom_enrollments ce ON ce.lead_id = l.id
       WHERE p.razorpay_order_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    if (row.payment_status === 'REFUNDED') {
      return {
        status: 'REFUNDED',
        message: 'Your payment was refunded. Course access has been revoked.',
      };
    }

    if (row.payment_status === 'FAILED') {
      return {
        status: 'PAYMENT_FAILED',
        message: 'Payment failed. No course access granted.',
      };
    }

    if (row.payment_status === 'PENDING') {
      return {
        status: 'PAYMENT_PENDING',
        message: 'Awaiting payment confirmation.',
      };
    }

    if (row.payment_status === 'PAID') {
      const courseId = row.course_id || env.GOOGLE_CLASSROOM_COURSE_ID;
      const directClassroomUrl = `https://classroom.google.com/c/${courseId}`;

      if (
        row.classroom_status === 'ENROLLED' ||
        row.enrollment_status === 'ENROLLED' ||
        row.classroom_status === 'INVITED'
      ) {
        return {
          status: 'INVITED',
          message: `Invitation sent to ${row.email_normalized}. Open Classroom and click Accept.`,
          classroomUrl: directClassroomUrl,
          email: row.email_normalized,
          orderId,
        };
      }

      if (row.last_error_code === 'INVALID_GOOGLE_EMAIL') {
        return {
          status: 'INVALID_GOOGLE_EMAIL',
          message: 'Payment received. The email provided is not a registered Google Account. Please provide your Google account email to receive your invitation.',
          email: row.email_normalized,
          orderId,
        };
      }

      if (row.classroom_status === 'FAILED' || row.enrollment_status === 'FAILED') {
        return {
          status: 'ENROLLMENT_FAILED',
          message: 'Payment received. Automated invitation is being retried. Our support team will ensure your access.',
          classroomUrl: directClassroomUrl,
          email: row.email_normalized,
          orderId,
        };
      }

      return {
        status: 'ENROLLMENT_PENDING',
        message: `Payment received. Sending invitation to ${row.email_normalized}...`,
        classroomUrl: directClassroomUrl,
        email: row.email_normalized,
        orderId,
      };
    }

    return {
      status: 'PAYMENT_PENDING',
      message: 'Processing payment status.',
    };
  }


  /**
   * Update Google account email for a paid lead and reset enrollment state
   */
  async updateGoogleEmail(orderId: string, newGoogleEmail: string): Promise<LeadRecord> {
    return withTransaction(async (client) => {
      const payRes = await client.query(
        `SELECT p.id, p.lead_id, p.status, l.payment_status
         FROM payments p
         JOIN leads l ON p.lead_id = l.id
         WHERE p.razorpay_order_id = $1
         LIMIT 1`,
        [orderId]
      );

      if (payRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const payment = payRes.rows[0];
      if (payment.status !== 'PAID' && payment.payment_status !== 'PAID') {
        throw new Error('Payment not confirmed. Cannot update enrollment email.');
      }

      const updatedLead = await client.query<LeadRecord>(
        `UPDATE leads
         SET email = $1, email_normalized = $2, enrollment_status = 'PENDING', updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newGoogleEmail, newGoogleEmail, payment.lead_id]
      );

      await client.query(
        `UPDATE classroom_enrollments
         SET google_email = $1, status = 'PENDING', last_error_code = NULL, last_error_message = NULL, updated_at = NOW()
         WHERE lead_id = $2`,
        [newGoogleEmail, payment.lead_id]
      );

      logger.info('Updated Google account email for paid lead', {
        leadId: payment.lead_id,
        newEmail: newGoogleEmail,
      });

      return updatedLead.rows[0];
    });
  }
}

export const leadService = new LeadService();
