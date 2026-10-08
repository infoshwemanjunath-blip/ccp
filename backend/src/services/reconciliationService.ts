import { query } from '../db/pool.js';
import { enrollmentWorkflowService } from './enrollmentWorkflowService.js';
import { logger } from '../utils/logger.js';

export interface UnreconciledPayment {
  payment_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  paid_at: Date;
  lead_id: string;
  full_name: string;
  email_normalized: string;
  phone: string;
  enrollment_id?: string;
  enrollment_status?: string;
  classroom_status?: string;
  last_error_message?: string;
}

export class ReconciliationService {
  /**
   * Find payments captured/paid in Razorpay with no matching or active enrollment in Supabase
   */
  async findUnreconciledPayments(): Promise<UnreconciledPayment[]> {
    const res = await query<UnreconciledPayment>(
      `SELECT 
         p.id AS payment_id,
         p.razorpay_order_id,
         p.razorpay_payment_id,
         p.amount,
         p.paid_at,
         l.id AS lead_id,
         l.full_name,
         l.email_normalized,
         l.phone,
         e.id AS enrollment_id,
         e.status AS enrollment_status,
         ce.status AS classroom_status,
         ce.last_error_message
       FROM payments p
       JOIN leads l ON p.lead_id = l.id
       LEFT JOIN enrollments e ON e.payment_id = p.razorpay_payment_id
       LEFT JOIN classroom_enrollments ce ON ce.lead_id = l.id
       WHERE p.status = 'PAID'
         AND (
             e.id IS NULL 
             OR e.status NOT IN ('INVITED', 'ENROLLED')
             OR ce.status IS NULL 
             OR ce.status NOT IN ('ENROLLED', 'INVITED')
         )
       ORDER BY p.paid_at DESC NULLS LAST`
    );

    return res.rows;
  }

  /**
   * Reconcile any paid orders missing active Google Classroom enrollment
   */
  async reconcilePayments(dryRun: boolean = true): Promise<{
    scanned: number;
    reconciled: number;
    failed: number;
    details: Array<{ orderId: string; email: string; status: string }>;
  }> {
    const items = await this.findUnreconciledPayments();
    logger.info('Reconciliation scan completed', {
      count: String(items.length),
      dryRun: String(dryRun),
    });

    const results: Array<{ orderId: string; email: string; status: string }> = [];
    let reconciledCount = 0;
    let failedCount = 0;

    for (const item of items) {
      if (dryRun) {
        results.push({
          orderId: item.razorpay_order_id,
          email: item.email_normalized,
          status: 'FLAGGED_UNRECONCILED',
        });
        continue;
      }

      try {
        logger.info('Reconciling payment for student', {
          orderId: item.razorpay_order_id,
          paymentId: item.razorpay_payment_id,
          email: item.email_normalized,
        });

        await enrollmentWorkflowService.handlePaymentSuccess(
          item.razorpay_order_id,
          item.razorpay_payment_id || `rec_${Date.now()}`,
          item.paid_at || new Date(),
          item.email_normalized,
          item.full_name
        );

        reconciledCount++;
        results.push({
          orderId: item.razorpay_order_id,
          email: item.email_normalized,
          status: 'RECONCILED',
        });
      } catch (err: any) {
        failedCount++;
        logger.error('Failed reconciling payment for student', err, {
          orderId: item.razorpay_order_id,
          email: item.email_normalized,
        });
        results.push({
          orderId: item.razorpay_order_id,
          email: item.email_normalized,
          status: `ERROR: ${err?.message || 'Unknown error'}`,
        });
      }
    }

    return {
      scanned: items.length,
      reconciled: reconciledCount,
      failed: failedCount,
      details: results,
    };
  }
}

export const reconciliationService = new ReconciliationService();
