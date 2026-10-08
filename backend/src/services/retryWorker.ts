import { query, withTransaction } from '../db/pool.js';
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
      // Find and lock pending outbox jobs within an atomic transaction
      const jobs = await withTransaction(async (client) => {
        const jobsRes = await client.query(
          `SELECT id, payment_id, job_type, payload, attempts, max_attempts
           FROM outbox_jobs
           WHERE status = 'PENDING' AND next_run_at <= NOW()
           ORDER BY next_run_at ASC
           LIMIT 10
           FOR UPDATE SKIP LOCKED`
        );

        if (jobsRes.rows.length === 0) return [];

        const jobIds = jobsRes.rows.map((r: any) => r.id);
        await client.query(
          `UPDATE outbox_jobs SET status = 'PROCESSING', locked_at = NOW(), updated_at = NOW() WHERE id = ANY($1)`,
          [jobIds]
        );

        return jobsRes.rows;
      });

      for (const job of jobs) {
        logger.info('Processing outbox job', {
          jobId: job.id,
          jobType: job.job_type,
          attempt: String(job.attempts),
        });

        let success = false;
        let errorMessage = null;
        let errorCode = null;

        try {
          if (job.job_type === 'CLASSROOM_INVITE') {
            const result = await enrollmentWorkflowService.executeClassroomInvite(job.payload, job.attempts + 1);
            success = result.success;
            errorMessage = result.errorMessage;
            errorCode = result.errorCode;
          } else if (job.job_type === 'WELCOME_EMAIL') {
            const payload = job.payload;
            // Check if email already sent by looking at payload or external state if possible.
            // Assuming sendClassroomAccessEmail is mostly idempotent or we rely on outbox completion
            await import('./emailService.js').then(m => m.emailService.sendClassroomAccessEmail({
              toEmail: payload.toEmail,
              fullName: payload.fullName,
              courseId: payload.courseId
            }));
            success = true;
          } else if (job.job_type === 'CLASSROOM_REMOVE') {
            const payload = job.payload;
            const removalResult = await googleClassroomService.removeStudent(
              payload.leadId,
              payload.email,
              payload.googleUserId,
              payload.invitationId,
              payload.courseId
            );

            if (removalResult.success) {
              await query(
                `UPDATE classroom_enrollments SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [payload.enrollmentId]
              );
              await query(
                `UPDATE leads SET enrollment_status = 'REMOVED', updated_at = NOW() WHERE id = $1`,
                [payload.leadId]
              );
              success = true;
            } else {
              success = false;
              errorMessage = removalResult.errorMessage || removalResult.errorCode;
              errorCode = removalResult.errorCode;
            }
          }
        } catch (err: any) {
          success = false;
          errorMessage = err.message || 'Unknown error during job execution';
        }

        if (success) {
          await query(
            `UPDATE outbox_jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [job.id]
          );
        } else if (job.attempts + 1 >= job.max_attempts) {
          await query(
            `UPDATE outbox_jobs SET status = 'FAILED', last_error = $1, updated_at = NOW() WHERE id = $2`,
            [errorMessage, job.id]
          );
        } else {
          // Schedule next exponential retry
          const backoff = Math.pow(2, job.attempts + 1) * 30; // 60s, 120s, 240s...
          await query(
            `UPDATE outbox_jobs 
               SET status = 'PENDING', attempts = attempts + 1, last_error = $1, next_run_at = NOW() + ($2 || ' seconds')::INTERVAL, updated_at = NOW(), locked_at = NULL
               WHERE id = $3`,
            [errorMessage, backoff, job.id]
          );
        }
      }
    } catch (err) {
      logger.error('Error processing pending outbox jobs', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const retryWorker = new RetryWorker();
