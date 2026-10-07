import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { LeadRecord, CheckoutOrderResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

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

  /**
   * Create standard Razorpay order
   */
  async createStandardOrder(params: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string; [key: string]: any }> {
    const client = this.getClient();
    const order = await client.orders.create({
      amount: params.amount,
      currency: params.currency || 'INR',
      receipt: params.receipt || `rcpt_${Date.now()}`,
      notes: params.notes,
    });
    return order as any;
  }

  /**
   * Fetch order from Razorpay to read metadata/notes
   */
  async fetchOrder(orderId: string): Promise<any> {
    const client = this.getClient();
    return client.orders.fetch(orderId);
  }


  /**
   * Create Razorpay order server-side and record in payments table
   */
  async createOrder(lead: LeadRecord): Promise<CheckoutOrderResponse> {
    const amount = env.COURSE_PRICE_PAISE;
    const currency = env.COURSE_CURRENCY;
    const receipt = `rcpt_${lead.id.substring(0, 8)}_${Date.now()}`;

    const client = this.getClient();
    const order = await client.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        leadId: lead.id,
        email: lead.email_normalized,
      },
    });

    // Record order in payments table (graceful if DB offline)
    try {
      await query(
        `INSERT INTO payments (lead_id, razorpay_order_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         ON CONFLICT (razorpay_order_id) DO NOTHING`,
        [lead.id, order.id, amount, currency]
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
