import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { whatsappService } from '../services/whatsappService.js';
import { jobLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

export const jobRouter = Router();

function verifyJobSecret(reqSecret: string | undefined): boolean {
  if (!env.JOB_SECRET || !reqSecret) return false;
  const expectedBuf = Buffer.from(env.JOB_SECRET, 'utf8');
  const actualBuf = Buffer.from(reqSecret, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * POST /api/jobs/retry-invites or POST /jobs/retry-invites
 * Header: x-job-secret matching JOB_SECRET
 */
jobRouter.post('/retry-invites', jobLimiter, async (req: Request, res: Response) => {
  const secretHeader = (req.headers['x-job-secret'] as string) || '';

  if (!verifyJobSecret(secretHeader)) {
    logger.warn('Unauthorized attempt to trigger retry-invites job');
    return res.status(401).json({ error: 'Unauthorized: invalid or missing x-job-secret header' });
  }

  try {
    if (whatsappService.isRetryRunning()) {
      return res.status(200).json({
        status: 'running',
        message: 'A retry batch is currently in progress.',
      });
    }

    const candidates = await whatsappService.findRetryCandidates(20);

    if (candidates.length === 0) {
      return res.status(200).json({
        status: 'ok',
        retried: 0,
        message: 'No pending or failed WhatsApp invites eligible for retry.',
      });
    }

    // Launch background batch with random 3-6s delay
    whatsappService.runRetryBatch(candidates);

    return res.status(200).json({
      status: 'queued',
      retried: candidates.length,
      message: `Queued ${candidates.length} WhatsApp invites for retry.`,
    });
  } catch (error: any) {
    logger.error('Error in retry-invites job', error);
    return res.status(500).json({ error: 'Failed to process retry job' });
  }
});
