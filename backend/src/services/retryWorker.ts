import { query } from '../db/pool.js';
import { enrollmentWorkflowService } from './enrollmentWorkflowService.js';
import { googleClassroomService } from './googleClassroomService.js';
import { logger } from '../utils/logger.js';
import { LeadRecord } from '../types/index.js';

export class RetryWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start(intervalMs: number = 30000): void {
    if (this.timer) return;
    logger.info('Starting background enrollment retry worker', {
      intervalMs: String(intervalMs),
    });

    this.timer = setInterval(() => {
      this.processPendingJobs().catch((err) => {
        logger.error('Error during retry worker cycle', err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped background enrollment retry worker');
    }
  }

  async processPendingJobs(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find pending jobs whose scheduled retry time has arrived
      const jobsRes = await query(
        `SELECT j.id, j.enrollment_id, j.action, j.attempts, j.max_attempts,
                ce.lead_id, ce.course_id, ce.google_email, ce.google_user_id, ce.invitation_id,
                l.id as lead_id, l.email_normalized, l.full_name, l.phone, l.payment_status, l.enrollment_status
         FROM enrollment_jobs j
         JOIN classroom_enrollments ce ON j.enrollment_id = ce.id
         JOIN leads l ON ce.lead_id = l.id
         WHERE j.status = 'PENDING' AND j.next_run_at <= NOW()
         ORDER BY j.next_run_at ASC
         LIMIT 10`
      );

      for (const job of jobsRes.rows) {
        logger.info('Processing retry job', {
          jobId: job.id,
          action: job.action,
          attempt: String(job.attempts),
        });

        // Mark processing
        await query(
          `UPDATE enrollment_jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1`,
          [job.id]
        );

        if (job.action === 'ENROLL') {
          const lead: LeadRecord = {
            id: job.lead_id,
            full_name: job.full_name,
            phone: job.phone,
            email: job.email_normalized,
            email_normalized: job.email_normalized,
            payment_status: job.payment_status,
            enrollment_status: job.enrollment_status,
            created_at: new Date(),
            updated_at: new Date(),
          };

          await enrollmentWorkflowService.executeEnrollment(lead, true);

          // Check if enrollment succeeded
          const checkRes = await query(
            `SELECT status FROM classroom_enrollments WHERE id = $1`,
            [job.enrollment_id]
          );

          if (checkRes.rows[0]?.status === 'ENROLLED') {
            await query(
              `UPDATE enrollment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
              [job.id]
            );
          } else if (job.attempts + 1 >= job.max_attempts) {
            await query(
              `UPDATE enrollment_jobs SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
              [job.id]
            );
          } else {
            // Schedule next exponential retry
            const backoff = Math.pow(2, job.attempts + 1) * 15;
            await query(
              `UPDATE enrollment_jobs 
               SET status = 'PENDING', attempts = attempts + 1, next_run_at = NOW() + ($1 || ' seconds')::INTERVAL, updated_at = NOW()
               WHERE id = $2`,
              [backoff, job.id]
            );
          }
        } else if (job.action === 'REMOVE') {
          const removalResult = await googleClassroomService.removeStudent(
            job.lead_id,
            job.email_normalized,
            job.google_user_id,
            job.invitation_id,
            job.course_id
          );

          if (removalResult.success) {
            await query(
              `UPDATE classroom_enrollments SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW() WHERE id = $1`,
              [job.enrollment_id]
            );
            await query(
              `UPDATE leads SET enrollment_status = 'REMOVED', updated_at = NOW() WHERE id = $1`,
              [job.lead_id]
            );
            await query(
              `UPDATE enrollment_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
              [job.id]
            );
          } else if (job.attempts + 1 >= job.max_attempts) {
            await query(
              `UPDATE enrollment_jobs SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
              [job.id]
            );
          } else {
            const backoff = Math.pow(2, job.attempts + 1) * 30;
            await query(
              `UPDATE enrollment_jobs 
               SET status = 'PENDING', attempts = attempts + 1, next_run_at = NOW() + ($1 || ' seconds')::INTERVAL, updated_at = NOW()
               WHERE id = $2`,
              [backoff, job.id]
            );
          }
        }
      }
    } catch (err) {
      logger.error('Error processing pending enrollment jobs', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const retryWorker = new RetryWorker();
