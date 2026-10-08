import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import * as poolModule from '../src/db/pool.js';
import { leadService } from '../src/services/leadService.js';
import { enrollmentWorkflowService } from '../src/services/enrollmentWorkflowService.js';
import { googleClassroomService } from '../src/services/googleClassroomService.js';
import { emailService } from '../src/services/emailService.js';
import { webhookService } from '../src/services/webhookService.js';
import { reconciliationService } from '../src/services/reconciliationService.js';
import { env } from '../src/config/env.js';

describe('Concurrency & Race-Condition Tests (50+ Simultaneous Users)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('TEST 1: 50 concurrent order creations should succeed without HTTP 429 or duplicate lead errors', async () => {
    // Mock database query to simulate atomic UPSERT
    let leadCreatedCount = 0;
    vi.spyOn(poolModule, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO leads') || sql.includes('ON CONFLICT (email_normalized)')) {
        leadCreatedCount++;
        return {
          rows: [
            {
              id: 'a0000000-0000-0000-0000-000000000001',
              full_name: params?.[0] || 'Concurrent Student',
              phone: params?.[1] || '9876543210',
              email: params?.[2] || 'student@example.com',
              email_normalized: params?.[3] || 'student@example.com',
              payment_status: 'PENDING',
              enrollment_status: 'PENDING',
            },
          ],
          rowCount: 1,
          command: '',
          oid: 0,
          fields: [],
        };
      }
      if (sql.includes('INSERT INTO payments')) {
        return { rows: [], rowCount: 1, command: '', oid: 0, fields: [] };
      }
      if (sql.includes('UPDATE leads SET latest_order_id')) {
        return { rows: [], rowCount: 1, command: '', oid: 0, fields: [] };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    // Fire 50 simultaneous requests to /api/enrollment/create-order
    const requests = Array.from({ length: 50 }, (_, i) =>
      request(app)
        .post('/api/enrollment/create-order')
        .send({
          name: `User ${i}`,
          phone: `98765432${String(i).padStart(2, '0')}`,
          email: `concurrent_user_${i}@gmail.com`,
        })
    );

    const responses = await Promise.all(requests);

    // Verify all 50 requests succeed with 200 OK (no 429 rate limit errors)
    const statusCodes = responses.map((r) => r.status);
    expect(statusCodes.filter((s) => s === 200).length).toBe(50);
    expect(statusCodes).not.toContain(429);

    for (const res of responses) {
      expect(res.body).toHaveProperty('orderId');
      expect(res.body.amount).toBe(env.COURSE_PRICE_PAISE);
      expect(res.body.alreadyEnrolled).toBe(false);
    }
  });

  it('TEST 2: Fast-path verify and Webhook firing simultaneously for same order should result in EXACTLY ONE invitation', async () => {
    const orderId = 'order_race_test_100';
    const paymentId = 'pay_race_test_200';
    const email = 'race.student@gmail.com';

    // Mock classroom invite & email
    const classroomSpy = vi
      .spyOn(googleClassroomService, 'enrollStudent')
      .mockResolvedValue({
        success: true,
        status: 'INVITED',
        invitationId: 'inv_race_123',
      });

    const emailSpy = vi
      .spyOn(emailService, 'sendClassroomAccessEmail')
      .mockResolvedValue(true);

    // In-memory payment row state to test atomicity
    let paymentStatus = 'PENDING';
    const leadId = 'b0000000-0000-0000-0000-000000000002';

    // Model real PostgreSQL row-lock serialization for concurrent transactions
    let txQueue = Promise.resolve();
    vi.spyOn(poolModule, 'withTransaction').mockImplementation(async (cb: any) => {
      const prevLock = txQueue;
      let release: () => void;
      txQueue = new Promise((res) => {
        release = res;
      });
      await prevLock;

      try {
        const mockClient = {
          query: vi.fn(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT id, lead_id FROM payments WHERE razorpay_order_id = $1')) {
              return {
                rows: [{ id: 'p_race_1', lead_id: leadId }]
              } as any;
            }
            if (sql.includes('INSERT INTO outbox_jobs')) {
              outboxInserts++;
              return { rows: [] } as any;
            }
            if (sql.includes('payments') && sql.includes('FOR UPDATE')) {
              return {
                rows: [
                  {
                    id: 'p_race_1',
                    lead_id: leadId,
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    status: paymentStatus,
                  },
                ],
              };
            }
            if (sql.includes('UPDATE payments') && sql.includes('PAID')) {
              paymentStatus = 'PAID';
              return { rows: [] };
            }
            if (sql.includes('leads') && sql.includes('FOR UPDATE')) {
              return {
                rows: [
                  {
                    id: leadId,
                    full_name: 'Race Student',
                    email: email,
                    email_normalized: email,
                    payment_status: 'PENDING',
                    enrollment_status: 'PENDING',
                  },
                ],
              };
            }
            if (sql.includes('UPDATE leads') && sql.includes('PAID')) {
              return {
                rows: [
                  {
                    id: leadId,
                    full_name: 'Race Student',
                    email: email,
                    email_normalized: email,
                    payment_status: 'PAID',
                    enrollment_status: 'PENDING',
                  },
                ],
              };
            }
            if (sql.includes('classroom_enrollments') && sql.includes('FOR UPDATE')) {
              return { rows: [{ status: 'PENDING', attempt_count: 0 }] };
            }
            return { rows: [] };
          }),
        };
        return await cb(mockClient);
      } finally {
        release!();
      }
    });

    let outboxInserts = 0;
    vi.spyOn(poolModule, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      return { rows: [] } as any;
    });

    // Fire dual concurrent execution
    const runFastPath = enrollmentWorkflowService.handlePaymentSuccess(
      orderId,
      paymentId,
      new Date(),
      email,
      'Race Student'
    );

    const runWebhook = enrollmentWorkflowService.handlePaymentSuccess(
      orderId,
      paymentId,
      new Date(),
      email,
      'Race Student'
    );

    await Promise.all([runFastPath, runWebhook]);

    // outbox_jobs must be queued EXACTLY ONCE
    expect(outboxInserts).toBe(1);
  });

  it('TEST 3: 50 duplicate webhook deliveries should all return 200/DUPLICATE with zero duplicate invites', async () => {
    const enrollSuccessSpy = vi
      .spyOn(enrollmentWorkflowService, 'handlePaymentSuccess')
      .mockResolvedValue();

    let processedCount = 0;
    vi.spyOn(poolModule, 'withTransaction').mockImplementation(async (cb: any) => {
      const mockClient = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('INSERT INTO payment_events')) {
            if (processedCount === 0) {
              processedCount++;
              return { rows: [{ id: 'evt_dup_999', processed: false }] };
            }
            return { rows: [] }; // Already exists
          }
          if (sql.includes('SELECT id, processed FROM payment_events')) {
            return { rows: [{ id: 'evt_dup_999', processed: true }] };
          }
          return { rows: [] };
        }),
      };
      return cb(mockClient);
    });

    vi.spyOn(poolModule, 'query').mockResolvedValue({ rows: [] } as any);

    const payload = JSON.stringify({
      id: 'evt_dup_999',
      event: 'order.paid',
      payload: {
        order: {
          entity: {
            id: 'order_dup_999',
            amount: env.COURSE_PRICE_PAISE,
          },
        },
      },
    });

    const sig = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Send 50 duplicate deliveries concurrently
    const deliveries = Array.from({ length: 50 }, () =>
      webhookService.handleWebhook(payload, sig, JSON.parse(payload))
    );

    const results = await Promise.all(deliveries);

    // Exactly 1 processed, 49 duplicates
    const processed = results.filter((r) => r.status === 'PROCESSED');
    const duplicates = results.filter((r) => r.status === 'DUPLICATE');

    expect(processed.length).toBe(1);
    expect(duplicates.length).toBe(49);
    expect(enrollSuccessSpy).toHaveBeenCalledTimes(1);
  });

  it('TEST 4: Reconciliation service identifies captured payments with missing enrollment', async () => {
    vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
      rows: [
        {
          payment_id: 'p_unrec_1',
          razorpay_order_id: 'order_unrec_1',
          razorpay_payment_id: 'pay_unrec_1',
          amount: 349900,
          paid_at: new Date(),
          lead_id: 'lead_unrec_1',
          full_name: 'Unreconciled Student',
          email_normalized: 'student.unrec@example.com',
          phone: '9876543210',
          enrollment_id: undefined,
          enrollment_status: undefined,
          classroom_status: undefined,
        },
      ],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    });

    const unreconciled = await reconciliationService.findUnreconciledPayments();
    expect(unreconciled.length).toBe(1);
    expect(unreconciled[0].razorpay_order_id).toBe('order_unrec_1');
    expect(unreconciled[0].email_normalized).toBe('student.unrec@example.com');
  });
});
