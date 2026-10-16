import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { LeadRecord, CheckoutOrderResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { toIndianMobile91 } from '../utils/validation.js';

export class RazorpayService {
  private razorpayInstance: Razorpay | null = null;

  public getClient(): Razorpay {
    if (!this.razorpayInstance) {
      this.razorpayInstance = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.razorpayInstance;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 200, timeoutMs = 10000): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Razorpay request timeout')), timeoutMs);
        });
        const result = await Promise.race([fn(), timeoutPromise]);
        clearTimeout(timer!);
        return result;
      } catch (err: any) {
        lastError = err;
        const statusCode = err?.statusCode || err?.status_code || err?.status;
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          throw err;
        }
        if (attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Create standard Razorpay order with exponential backoff
   */
  async createStandardOrder(params: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string;[key: string]: any }> {
    const client = this.getClient();
    const order = await this.withRetry(() =>
      client.orders.create({
        amount: params.amount,
        currency: params.currency || 'INR',
        receipt: params.receipt || `rcpt_${Date.now()}`,
        notes: params.notes,
      })
    );
    return order as any;
  }

  /**
   * Fetch order from Razorpay to read metadata/notes with retry
   */
  async fetchOrder(orderId: string): Promise<any> {
    const client = this.getClient();
    return this.withRetry(() => client.orders.fetch(orderId));
  }

  /**
   * Fetch payment from Razorpay API (authoritative status: created/authorized/captured/failed/refunded)
   */
  async fetchPayment(paymentId: string): Promise<any> {
    const client = this.getClient();
    return this.withRetry(() => client.payments.fetch(paymentId));
  }

  /**
   * Create Razorpay order server-side and record in payments table
   */
  async createOrder(lead: LeadRecord): Promise<CheckoutOrderResponse> {
    const amount = env.COURSE_PRICE_PAISE;
    const currency = env.COURSE_CURRENCY;
    const receipt = `rcpt_${lead.id.substring(0, 8)}_${Date.now()}`;

    // Check for an existing PENDING order created in the last 15 minutes
    try {
      const existingRes = await query(
        `SELECT razorpay_order_id, amount, currency 
         FROM payments 
         WHERE lead_id = $1 AND amount = $2 AND status = 'PENDING' AND created_at > NOW() - INTERVAL '15 minutes'
         ORDER BY created_at DESC LIMIT 1`,
        [lead.id, amount]
      );

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        // Keep the paid-phone snapshot in sync with the latest form submission
        await query(
          `UPDATE payments SET customer_phone = $1 WHERE razorpay_order_id = $2 AND status = 'PENDING'`,
          [toIndianMobile91(lead.phone), existing.razorpay_order_id]
        );
        logger.info('Reusing existing pending Razorpay order', { leadId: lead.id, orderId: existing.razorpay_order_id });
        return {
          orderId: existing.razorpay_order_id,
          amount: existing.amount,
          currency: existing.currency,
          keyId: env.RAZORPAY_KEY_ID,
        };
      }
    } catch (dbErr) {
      logger.warn('Failed to check for existing pending order, creating new one', { leadId: lead.id });
    }

    const client = this.getClient();
    const order = await this.withRetry(() =>
      client.orders.create({
        amount,
        currency,
        receipt,
        notes: {
          leadId: lead.id,
          email: lead.email_normalized,
        },
      })
    );

    // Record order in payments table (graceful if DB offline)
    try {
      await query(
        `INSERT INTO payments (lead_id, razorpay_order_id, amount, currency, status, customer_phone)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)
         ON CONFLICT (razorpay_order_id) DO NOTHING`,
        [lead.id, order.id, amount, currency, toIndianMobile91(lead.phone)]
      );
    } catch (dbErr) {
      logger.warn('Could not persist payment to DB, proceeding with checkout', {
        orderId: order.id,
      });
    }

    logger.info('Created Razorpay order server-side', {
      leadId: lead.id,
      orderId: order.id,
      amount,
    });

    return {
      orderId: order.id,
      amount,
      currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Verify frontend checkout payment signature using HMAC SHA256 with timingSafeEqual
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    try {
      const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const expectedBuf = Buffer.from(generatedSignature, 'utf8');
      const actualBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch (err) {
      logger.error('Signature verification error', err, { orderId, paymentId });
      return false;
    }
  }

  /**
   * Verify Razorpay webhook signature against raw request body
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    try {
      const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(bodyString)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== actualBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    } catch (err) {
      logger.error('Webhook signature verification error', err);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
