import { query } from '../db/pool.js';
import { LeadRecord, EnrollmentStatusResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

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
    const existing = await query<LeadRecord>(
      `SELECT * FROM leads WHERE email_normalized = $1 LIMIT 1`,
      [emailNormalized]
    );

    if (existing.rows.length > 0) {
      const lead = existing.rows[0];

      // If customer has already paid, prevent duplicate payment even if enrollment is pending
      if (lead.payment_status === 'PAID') {
        logger.info('Lead already paid', {
          leadId: lead.id,
          email: emailNormalized,
        });
        return { lead, alreadyEnrolled: true };
      }

      // Update lead details with latest submission
      const updated = await query<LeadRecord>(
        `UPDATE leads 
         SET full_name = $1, phone = $2, email = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [fullName, phone, email, lead.id]
      );

      logger.info('Updated existing lead', {
        leadId: lead.id,
        email: emailNormalized,
      });
      return { lead: updated.rows[0], alreadyEnrolled: false };
    }

    // Insert new lead
    const inserted = await query<LeadRecord>(
      `INSERT INTO leads (full_name, phone, email, email_normalized, payment_status, enrollment_status)
       VALUES ($1, $2, $3, $4, 'PENDING', 'PENDING')
       RETURNING *`,
      [fullName, phone, email, emailNormalized]
    );

    logger.info('Created new lead', {
      leadId: inserted.rows[0].id,
      email: emailNormalized,
    });
    return { lead: inserted.rows[0], alreadyEnrolled: false };
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
         l.payment_status, 
         l.enrollment_status,
         ce.status as classroom_status
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

    if (row.payment_status === 'PENDING') {
      return {
        status: 'PAYMENT_PENDING',
        message: 'Awaiting payment confirmation.',
      };
    }

    if (row.payment_status === 'PAID') {
      if (row.classroom_status === 'ENROLLED' || row.enrollment_status === 'ENROLLED') {
        return {
          status: 'ENROLLMENT_SUCCESS',
          message: 'Your payment was successful and your course invitation has been sent to your Google account.',
        };
      }

      if (row.classroom_status === 'FAILED' || row.enrollment_status === 'FAILED') {
        return {
          status: 'ENROLLMENT_FAILED',
          message: 'Payment received. Automated invitation encountered an issue. Our support team has been notified to activate your access immediately.',
        };
      }

      return {
        status: 'ENROLLMENT_PENDING',
        message: 'Payment received. Your course access is being activated in Google Classroom.',
      };
    }

    return {
      status: 'PAYMENT_PENDING',
      message: 'Processing payment status.',
    };
  }
}

export const leadService = new LeadService();
