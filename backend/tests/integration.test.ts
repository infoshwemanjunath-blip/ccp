import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import * as poolModule from '../src/db/pool.js';
import { razorpayService } from '../src/services/razorpayService.js';
import { googleClassroomService } from '../src/services/googleClassroomService.js';
import { env } from '../src/config/env.js';

describe('Integration Tests - Enrollment & Payment Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health should return 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/enrollment/create-order should validate input and return 400 on invalid payload', async () => {
    const res = await request(app)
      .post('/api/enrollment/create-order')
      .send({
        name: 'A',
        phone: '123',
        email: 'invalid-email',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toHaveProperty('name');
    expect(res.body.details).toHaveProperty('phone');
    expect(res.body.details).toHaveProperty('email');
  });

  it('POST /api/enrollment/create-order should return alreadyEnrolled: true if user is already enrolled', async () => {
    vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          id: 'lead-123',
          email_normalized: 'already@gmail.com',
          payment_status: 'PAID',
          enrollment_status: 'ENROLLED',
        },
      ],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    });

    const res = await request(app)
      .post('/api/enrollment/create-order')
      .send({
        name: 'John Doe',
        phone: '9876543210',
        email: 'already@gmail.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.alreadyEnrolled).toBe(true);
  });

  it('POST /api/payment/verify should reject invalid signature', async () => {
    const res = await request(app)
      .post('/api/payment/verify')
      .send({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_456',
        razorpay_signature: 'fake_invalid_sig',
      });

    expect(res.status).toBe(400);
    expect(res.body.verified).toBe(false);
  });

  it('POST /api/webhooks/razorpay should reject requests without signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .send({ event: 'order.paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing webhook signature header');
  });

  it('POST /api/webhooks/razorpay should reject invalid webhook signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'invalid_signature_hex')
      .send({ event: 'order.paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid signature');
  });

  it('POST /api/webhooks/razorpay should accept valid webhook and handle idempotency', async () => {
    const payload = JSON.stringify({
      id: 'evt_unique_123',
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: 'order_test_999',
            paid_at: 1700000000,
          },
        },
      },
    });

    const signature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Mock withTransaction for payment_events duplicate check
    vi.spyOn(poolModule, 'withTransaction').mockResolvedValueOnce({
      id: 'evt_unique_123',
      processed: true
    }); // Mock existing processed event

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DUPLICATE');
  });

  describe('Standard Razorpay Endpoints (/api/create-order & /api/verify-payment)', () => {
    it('POST /api/create-order should ignore input amount and use COURSE_PRICE_PAISE', async () => {
      vi.spyOn(razorpayService, 'createStandardOrder').mockResolvedValueOnce({
        id: 'order_std_123',
        amount: env.COURSE_PRICE_PAISE,
        currency: 'INR',
      } as any);

      const resMissing = await request(app)
        .post('/api/create-order')
        .send({});
      
      expect(resMissing.status).toBe(200);
      expect(resMissing.body.amount).toBe(env.COURSE_PRICE_PAISE);

      vi.spyOn(razorpayService, 'createStandardOrder').mockResolvedValueOnce({
        id: 'order_std_124',
        amount: env.COURSE_PRICE_PAISE,
        currency: 'INR',
      } as any);

      const resTampered = await request(app)
        .post('/api/create-order')
        .send({ amount: 100 });
      expect(resTampered.status).toBe(200);
      expect(resTampered.body.amount).toBe(env.COURSE_PRICE_PAISE);
    });

    it('POST /api/create-order should return 401 when Razorpay auth fails', async () => {
      vi.spyOn(razorpayService, 'createStandardOrder').mockRejectedValueOnce({
        statusCode: 401,
        message: 'Unauthorized',
      });

      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 50000 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication failed');
    });

    it('POST /api/create-order should return 500 when Razorpay API errors', async () => {
      vi.spyOn(razorpayService, 'createStandardOrder').mockRejectedValueOnce(
        new Error('Network error connecting to Razorpay')
      );

      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 50000 });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Razorpay API error');
    });

    it('POST /api/verify-payment should return 400 on missing parameters', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({ razorpay_order_id: 'order_123' });

      expect(res.status).toBe(400);
      expect(res.body.verified).toBe(false);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('POST /api/verify-payment should reject invalid payment signature', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: 'order_abc',
          razorpay_payment_id: 'pay_xyz',
          razorpay_signature: 'invalid_forged_sig',
        });

      expect(res.status).toBe(400);
      expect(res.body.verified).toBe(false);
      expect(res.body.error).toBe('Signature verification failed');
    });

    it('POST /api/verify-payment should successfully verify valid payment signature', async () => {
      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const validSig = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
          email: 'valid@example.com',
          name: 'Valid User',
        });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.success).toBe(true);
    });
  });
});
