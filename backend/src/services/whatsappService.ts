import { query } from '../db/pool.js';
import { env, siteUrl } from '../config/env.js';
import { toIndianMobile91 } from '../utils/validation.js';
import { joinService, buildJoinUrl } from './joinService.js';
import { logger } from '../utils/logger.js';

const MAX_WA_ATTEMPTS = 5;
const WAAPI_TIMEOUT_MS = 15000;

/**
 * WaAPI returns two status fields: outer `status` (request reached the instance) and
 * `data.status` (instance actually sent it). Sent only if HTTP OK and neither is "error".
 */
export function isWaapiSent(httpOk: boolean, body: any): boolean {
  return httpOk && body?.status !== 'error' && body?.data?.status !== 'error';
}

export function buildInviteMessage(name: string | null | undefined, joinUrl: string): string {
  const firstName = (name || '').trim() || 'there';
  return (
    `Hi ${firstName}! 🎉\n\n` +
    `Your payment for the Super Profit Masterclass is confirmed. Thank you!\n\n` +
    `Open your personal join page to get your Google Classroom access:\n${joinUrl}\n\n` +
    `Use the same mobile number you paid with to unlock it.\n\n` +
    `If you have trouble joining, just reply to this message.`
  );
}

interface ClaimedOrder {
  id: string;
  razorpay_order_id: string;
  customer_phone: string | null;
  lead_id: string;
  wa_attempts: number;
}

export class WhatsAppService {
  private retryRunning = false;

  /** Fire-and-forget first invite (webhook path). Never blocks the HTTP response. */
  queueFirstInvite(paymentRowId: string): void {
    if (!env.SEND_WHATSAPP) return;
    setImmediate(() => {
      this.attemptSend(paymentRowId, ['pending'], 0).catch((err) =>
        logger.error('WhatsApp invite task crashed', err, { paymentRowId })
      );
    });
  }

  /**
   * Atomically claims one send attempt (optimistic check on wa_attempts) so concurrent
   * webhook deliveries / retry runs can never double-send, then calls WaAPI.
   */
  async attemptSend(
    paymentRowId: string,
    allowedStatuses: Array<'pending' | 'failed'>,
    expectedAttempts: number
  ): Promise<'sent' | 'failed' | 'skipped'> {
    if (!env.SEND_WHATSAPP) return 'skipped';

    const claimRes = await query<ClaimedOrder>(
      `UPDATE payments
          SET wa_attempts = wa_attempts + 1
        WHERE id = $1
          AND status = 'PAID'
          AND wa_status = ANY($2)
          AND wa_attempts = $3
          AND wa_attempts < $4
        RETURNING id, razorpay_order_id, customer_phone, lead_id, wa_attempts`,
      [paymentRowId, allowedStatuses, expectedAttempts, MAX_WA_ATTEMPTS]
    );
    const order = claimRes.rows[0];
    if (!order) return 'skipped'; // already sent/claimed elsewhere, or historical order

    const orderId = order.razorpay_order_id;
    const leadRes = await query(`SELECT full_name, phone FROM leads WHERE id = $1`, [order.lead_id]);
    const lead = leadRes.rows[0];

    const phone = order.customer_phone || toIndianMobile91(lead?.phone);
    if (!phone) return this.finish(order, 'failed', 'Invalid or missing phone number');
    if (!env.WAAPI_TOKEN || !env.WAAPI_INSTANCE_ID) {
      return this.finish(order, 'failed', 'WAAPI_TOKEN / WAAPI_INSTANCE_ID not configured');
    }
    if (!siteUrl) return this.finish(order, 'failed', 'SITE_URL not configured');

    // Raw tokens can't be recovered from hashes, so every attempt mints a fresh token
    let rawToken = '';
    try {
      rawToken = await joinService.createToken(order.id, orderId, 'whatsapp');
    } catch (err: any) {
      return this.finish(order, 'failed', `Join token creation failed: ${err?.message || 'unknown'}`);
    }

    let status: 'sent' | 'failed' = 'failed';
    let errText: string | null = null;

    try {
      const r = await fetch(
        `https://waapi.app/api/v1/instances/${encodeURIComponent(env.WAAPI_INSTANCE_ID)}/client/action/send-message`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WAAPI_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            chatId: `${phone}@c.us`,
            message: buildInviteMessage(lead?.full_name, buildJoinUrl(rawToken)),
          }),
          signal: AbortSignal.timeout(WAAPI_TIMEOUT_MS),
        }
      );
      const body = await r.json().catch(() => ({}));

      if (isWaapiSent(r.ok, body)) {
        status = 'sent';
      } else {
        errText = `HTTP ${r.status}: ${JSON.stringify(body)}`;
      }
    } catch (err: any) {
      errText = err?.name === 'TimeoutError' ? 'WaAPI request timed out' : err?.message || 'WaAPI request failed';
    }

    // WaAPI may echo the message back; never persist the raw token
    if (errText) errText = errText.split(rawToken).join('[token]').slice(0, 500);
    return this.finish(order, status, errText);
  }

  private async finish(
    order: ClaimedOrder,
    status: 'sent' | 'failed',
    errText: string | null
  ): Promise<'sent' | 'failed'> {
    await query(`UPDATE payments SET wa_status = $1, wa_error = $2 WHERE id = $3`, [status, errText, order.id]);

    if (status === 'sent') {
      logger.info('WhatsApp sent', { orderId: order.razorpay_order_id, attempt: order.wa_attempts });
    } else {
      const safeReason = (errText || 'unknown').replace(/\d{10,}/g, '[number]');
      logger.error('WhatsApp failed', safeReason, { orderId: order.razorpay_order_id, attempt: order.wa_attempts });
    }
    return status;
  }

  /** Paid orders whose WhatsApp is pending/failed, < 5 attempts, paid > 2 min ago */
  async findRetryCandidates(limit = 20): Promise<Array<{ id: string; wa_attempts: number }>> {
    const res = await query<{ id: string; wa_attempts: number }>(
      `SELECT id, wa_attempts
         FROM payments
        WHERE status = 'PAID'
          AND wa_status IN ('pending', 'failed')
          AND wa_attempts < $1
          AND paid_at < NOW() - INTERVAL '2 minutes'
        ORDER BY paid_at ASC
        LIMIT $2`,
      [MAX_WA_ATTEMPTS, limit]
    );
    return res.rows;
  }

  isRetryRunning(): boolean {
    return this.retryRunning;
  }

  /** Sends sequentially with a random 3–6 s gap. Runs in background; one batch at a time. */
  runRetryBatch(candidates: Array<{ id: string; wa_attempts: number }>): void {
    if (this.retryRunning) return;
    this.retryRunning = true;

    (async () => {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        await this.attemptSend(c.id, ['pending', 'failed'], c.wa_attempts).catch((err) =>
          logger.error('WhatsApp retry attempt crashed', err, { paymentRowId: c.id })
        );
        if (i < candidates.length - 1) {
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000));
        }
      }
    })()
      .catch((err) => logger.error('WhatsApp retry batch crashed', err))
      .finally(() => {
        this.retryRunning = false;
      });
  }
}

export const whatsappService = new WhatsAppService();
