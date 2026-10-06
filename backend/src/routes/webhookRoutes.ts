import { Router, Request, Response } from 'express';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';

export const webhookRouter = Router();

/**
 * POST /api/webhooks/razorpay
 * Authoritative payment event listener with HMAC signature verification & idempotency
 */
webhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;

  if (!signature) {
    logger.warn('Webhook request missing x-razorpay-signature header');
    return res.status(400).json({ error: 'Missing webhook signature header' });
  }

  // Access the raw buffer captured by express.json({ verify })
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  try {
    const result = await webhookService.handleWebhook(
      rawBody,
      signature,
      req.body
    );

    return res.status(200).json({
      received: true,
      status: result.status,
    });
  } catch (error: any) {
    logger.error('Webhook processing failure', error);
    if (error.message === 'Invalid webhook signature') {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    // Return 500 so Razorpay retries if an unexpected internal error occurred
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});
