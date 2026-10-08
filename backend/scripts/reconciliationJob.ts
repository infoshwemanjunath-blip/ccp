import { query } from '../src/db/pool.js';
import { logger } from '../src/utils/logger.js';
import { env } from '../src/config/env.js';

async function runReconciliation() {
  logger.info('Starting daily reconciliation job');
  
  try {
    const res = await query(`
      SELECT p.id as payment_id, p.lead_id, l.email_normalized, l.full_name, p.razorpay_order_id, ce.status as ce_status
      FROM payments p
      JOIN leads l ON p.lead_id = l.id
      LEFT JOIN classroom_enrollments ce ON ce.lead_id = l.id
      WHERE p.status = 'PAID'
        AND (ce.id IS NULL OR ce.status != 'ENROLLED')
        AND p.created_at < NOW() - INTERVAL '1 hour'
    `);

    logger.info(`Found ${res.rows.length} stuck enrollments`);

    let recovered = 0;
    for (const row of res.rows) {
      try {
        await query(
          `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
           VALUES ($1, 'CLASSROOM_INVITE', $2, 'PENDING')
           ON CONFLICT (payment_id, job_type) DO NOTHING`,
          [
            row.payment_id,
            JSON.stringify({
              leadId: row.lead_id,
              email: row.email_normalized,
              fullName: row.full_name,
              courseId: env.GOOGLE_CLASSROOM_COURSE_ID,
              orderId: row.razorpay_order_id
            })
          ]
        );
        recovered++;
      } catch (err) {
        logger.error(`Failed to reconcile payment ${row.payment_id}`, err);
      }
    }

    logger.info(`Successfully queued ${recovered} outbox jobs for reconciliation`);
  } catch (error) {
    logger.error('Error running reconciliation job', error);
  } finally {
    process.exit(0);
  }
}

runReconciliation();
