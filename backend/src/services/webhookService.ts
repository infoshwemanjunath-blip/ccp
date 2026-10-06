import crypto from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import { razorpayService } from './razorpayService.js';
import { enrollmentWorkflowService } from './enrollmentWorkflowService.js';
import { logger } from '../utils/logger.js';

export class WebhookService {
  /**
   * Process incoming Razorpay webhook with strict signature validation & idempotency
   */
  async handleWebhook(
    rawBody: Buffer | string,
    signature: string,
    eventPayload: any
  ): Promise<{ status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' }> {
    // 1. Signature Verification
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Rejected Razorpay webhook with invalid signature');
      throw new Error('Invalid webhook signature');
    }

    const eventId = eventPayload.event_id || eventPayload.id;
    const eventType = eventPayload.event;

    if (!eventId || !eventType) {
      logger.warn('Malformed webhook payload missing event or id', { eventId, eventType });
      throw new Error('Malformed webhook payload');
    }

    const payloadHash = crypto
      .createHash('sha256')
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');

    // 2. Check Idempotency via payment_events table
    const eventRecord = await withTransaction(async (client) => {
      // Attempt to insert event record with UNIQUE constraint
      const insertRes = await client.query(
        `INSERT INTO payment_events (event_id, event_type, payload_hash, processed)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING id, processed`,
        [eventId, eventType, payloadHash]
      );

      if (insertRes.rows.length > 0) {
        return insertRes.rows[0];
      }

      // If no row returned from INSERT, event has already been recorded. Fetch it.
      const existing = await client.query(
        `SELECT id, processed FROM payment_events WHERE event_id = $1`,
        [eventId]
      );
      return existing.rows[0];
    });

    if (eventRecord && eventRecord.processed === true) {
      logger.info('Duplicate webhook event detected and already processed, skipping execution', {
        eventId,
        eventType,
      });
      return { status: 'DUPLICATE' };
    }

    logger.info('Processing new or pending authoritative webhook event', {
      eventId,
      eventType,
    });

    // 3. Handle Supported Event Types
    try {
      switch (eventType) {
        case 'order.paid': {
          const orderEntity = eventPayload.payload?.order?.entity;
          const paymentEntity = eventPayload.payload?.payment?.entity;
          const orderId = orderEntity?.id;
          const paymentId = paymentEntity?.id || `pay_${Date.now()}`;
          const paidAt = orderEntity?.paid_at
            ? new Date(orderEntity.paid_at * 1000)
            : new Date();

          if (orderId) {
            await enrollmentWorkflowService.handlePaymentSuccess(orderId, paymentId, paidAt);
          }
          break;
        }

        case 'payment.captured': {
          const paymentEntity = eventPayload.payload?.payment?.entity;
          const orderId = paymentEntity?.order_id;
          const paymentId = paymentEntity?.id;
          const paidAt = paymentEntity?.created_at
            ? new Date(paymentEntity.created_at * 1000)
            : new Date();

          if (orderId && paymentId) {
            await enrollmentWorkflowService.handlePaymentSuccess(orderId, paymentId, paidAt);
          }
          break;
        }

        case 'payment.failed': {
          const paymentEntity = eventPayload.payload?.payment?.entity;
          const orderId = paymentEntity?.order_id;

          if (orderId) {
            await query(
              `UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE razorpay_order_id = $1`,
              [orderId]
            );
            logger.info('Marked payment as FAILED from webhook', { orderId });
          }
          break;
        }

        case 'refund.created':
        case 'refund.processed':
        case 'payment.refunded': {
          const refundEntity = eventPayload.payload?.refund?.entity;
          const paymentEntity = eventPayload.payload?.payment?.entity;
          const paymentId = refundEntity?.payment_id || paymentEntity?.id;

          if (paymentId) {
            await enrollmentWorkflowService.handleRefund(undefined, paymentId);
          }
          break;
        }

        default: {
          logger.info('Ignoring unhandled webhook event type', { eventType });
          return { status: 'IGNORED' };
        }
      }

      // 4. Mark event as processed
      await query(
        `UPDATE payment_events SET processed = TRUE, processed_at = NOW() WHERE event_id = $1`,
        [eventId]
      );

      return { status: 'PROCESSED' };
    } catch (err: any) {
      logger.error('Error processing webhook event payload', err, { eventId, eventType });
      throw err;
    }
  }
}

export const webhookService = new WebhookService();
