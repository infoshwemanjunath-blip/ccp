import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import * as poolModule from '../src/db/pool.js';
import { toIndianMobile91 } from '../src/utils/validation.js';
import { isWaapiSent, buildInviteMessage } from '../src/services/whatsappService.js';
import { hashToken, joinService } from '../src/services/joinService.js';
import { env } from '../src/config/env.js';

describe('WhatsApp and Join Flow Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phone normalization toIndianMobile91', () => {
    it('normalizes various Indian mobile formats to 91XXXXXXXXXX', () => {
      expect(toIndianMobile91('98765 43210')).toBe('919876543210');
      expect(toIndianMobile91('+91 98765-43210')).toBe('919876543210');
      expect(toIndianMobile91('09876543210')).toBe('919876543210');
      expect(toIndianMobile91('919876543210')).toBe('919876543210');
      expect(toIndianMobile91('+919876543210')).toBe('919876543210');
    });

    it('rejects invalid or non-mobile numbers', () => {
      expect(toIndianMobile91('12345')).toBeNull();
      expect(toIndianMobile91('915876543210')).toBeNull(); // starts with 5
      expect(toIndianMobile91('abcdefghij')).toBeNull();
      expect(toIndianMobile91('')).toBeNull();
      expect(toIndianMobile91(null)).toBeNull();
    });
  });

  describe('WaAPI response validation', () => {
    it('requires HTTP 200 and neither outer nor inner status to be error', () => {
      expect(isWaapiSent(true, { status: 'success', data: { status: 'sent' } })).toBe(true);
      expect(isWaapiSent(true, { status: 'error', message: 'Failed' })).toBe(false);
      expect(isWaapiSent(true, { status: 'success', data: { status: 'error' } })).toBe(false);
      expect(isWaapiSent(false, { status: 'success', data: { status: 'sent' } })).toBe(false);
      expect(isWaapiSent(true, null)).toBe(true);
    });

    it('builds invite message containing customer name and join url', () => {
      const msg = buildInviteMessage('Aarav', 'https://example.com/join/tok123');
      expect(msg).toContain('Hi Aarav!');
      expect(msg).toContain('https://example.com/join/tok123');
      expect(msg).toContain('reply to this message');
    });
  });

  describe('Join Token Security', () => {
    it('produces 64-char sha256 hash', () => {
      const hash = hashToken('test_token_abc_123');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('API: POST /jobs/retry-invites', () => {
    it('rejects missing or wrong x-job-secret header with 401', async () => {
      const resMissing = await request(app).post('/jobs/retry-invites');
      expect(resMissing.status).toBe(401);

      const resWrong = await request(app)
        .post('/jobs/retry-invites')
        .set('x-job-secret', 'wrong_secret');
      expect(resWrong.status).toBe(401);
    });

    it('accepts correct x-job-secret and returns retry count', async () => {
      // Set a test job secret if empty
      const testSecret = env.JOB_SECRET || 'test_secret_12345678901234567890';
      (env as any).JOB_SECRET = testSecret;

      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app)
        .post('/jobs/retry-invites')
        .set('x-job-secret', testSecret);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.retried).toBe(0);
    });
  });

  describe('API: GET /join/check', () => {
    it('returns 400 when token query is missing', async () => {
      const res = await request(app).get('/join/check');
      expect(res.status).toBe(400);
      expect(res.body.state).toBe('invalid');
    });

    it('returns invalid state for non-existent token', async () => {
      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app).get('/join/check?token=non_existent_token_1234567890');
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('invalid');
    });

    it('returns valid state for active token on paid order', async () => {
      const rawToken = 'valid_token_123456789012345678901234';
      const hash = hashToken(rawToken);

      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [
          {
            token_hash: hash,
            expires_at: new Date(Date.now() + 86400000),
            order_id: 'order-uuid-1',
            razorpay_order_id: 'order_rzp_123',
            status: 'PAID',
            join_locked_until: null,
            join_reveal_count: 0,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(`/join/check?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('valid');
    });

    it('returns expired state if token expiration is past', async () => {
      const rawToken = 'expired_token_12345678901234567890';
      const hash = hashToken(rawToken);

      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [
          {
            token_hash: hash,
            expires_at: new Date(Date.now() - 10000),
            order_id: 'order-uuid-1',
            razorpay_order_id: 'order_rzp_123',
            status: 'PAID',
            join_locked_until: null,
            join_reveal_count: 0,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      const res = await request(app).get(`/join/check?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('expired');
    });
  });

  describe('API: POST /join/verify', () => {
    it('returns error on mismatched phone number without revealing paid phone', async () => {
      const rawToken = 'valid_token_for_verify_12345678901234';
      const hash = hashToken(rawToken);

      // 1. findToken query
      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [
          {
            token_hash: hash,
            expires_at: new Date(Date.now() + 86400000),
            order_id: 'order-uuid-1',
            razorpay_order_id: 'order_rzp_123',
            status: 'PAID',
            join_locked_until: null,
            join_reveal_count: 0,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      (env as any).GCR_LINK = 'https://classroom.google.com/c/test12345';

      // 2. withTransaction for row lock & mismatch check
      vi.spyOn(poolModule, 'withTransaction').mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation((sql: string) => {
            if (sql.includes('FOR UPDATE')) {
              return Promise.resolve({
                rows: [
                  {
                    id: 'order-uuid-1',
                    razorpay_order_id: 'order_rzp_123',
                    status: 'PAID',
                    customer_phone: '919876543210', // paid phone
                    join_failed_attempts: 0,
                    join_locked_until: null,
                    join_reveal_count: 0,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          }),
        };
        return cb(mockClient);
      });

      const res = await request(app)
        .post('/join/verify')
        .send({
          token: rawToken,
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '9888877777', // mismatched number
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Details don't match");
      // Never reveal paid phone or gcrLink
      expect(JSON.stringify(res.body)).not.toContain('919876543210');
      expect(JSON.stringify(res.body)).not.toContain('classroom.google.com');
    });

    it('returns gcrLink on matching phone number', async () => {
      const rawToken = 'valid_matching_token_12345678901234';
      const hash = hashToken(rawToken);

      // 1. findToken query
      vi.spyOn(poolModule, 'query').mockResolvedValueOnce({
        rows: [
          {
            token_hash: hash,
            expires_at: new Date(Date.now() + 86400000),
            order_id: 'order-uuid-1',
            razorpay_order_id: 'order_rzp_123',
            status: 'PAID',
            join_locked_until: null,
            join_reveal_count: 0,
          },
        ],
        rowCount: 1,
        command: '',
        oid: 0,
        fields: [],
      });

      (env as any).GCR_LINK = 'https://classroom.google.com/c/secret_course_abc';

      // 2. withTransaction for row lock & match
      vi.spyOn(poolModule, 'withTransaction').mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation((sql: string) => {
            if (sql.includes('FOR UPDATE')) {
              return Promise.resolve({
                rows: [
                  {
                    id: 'order-uuid-1',
                    razorpay_order_id: 'order_rzp_123',
                    status: 'PAID',
                    customer_phone: '919876543210',
                    join_failed_attempts: 0,
                    join_locked_until: null,
                    join_reveal_count: 0,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [] });
          }),
        };
        return cb(mockClient);
      });

      const res = await request(app)
        .post('/join/verify')
        .send({
          token: rawToken,
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+91 98765-43210', // matching formatted phone
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.gcrLink).toBe('https://classroom.google.com/c/secret_course_abc');
      expect(res.body.sessionToken).toBeDefined();
    });
  });

  describe('API: Join Session Endpoints (/join/status, /join/opened, /join/confirm)', () => {
    const rawSessionToken = crypto.randomBytes(32).toString('base64url');
    const sessionTokenHash = hashToken(rawSessionToken);

    it('GET /join/status rejects missing Authorization header with 401', async () => {
      const res = await request(app).get('/join/status');
      expect(res.status).toBe(401);
    });

    it('GET /join/status returns pending state and gcrLink when not joined', async () => {
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: null,
                joined_confirmed_at: null,
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      (env as any).GCR_LINK = 'https://classroom.google.com/c/test_active_course';

      const res = await request(app)
        .get('/join/status')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('pending');
      expect(res.body.name).toBe('Alex Student');
      expect(res.body.gcrLink).toBe('https://classroom.google.com/c/test_active_course');
    });

    it('GET /join/status returns joined state without gcrLink when confirmed', async () => {
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: new Date(),
                joined_confirmed_at: new Date(),
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      const res = await request(app)
        .get('/join/status')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('joined');
      expect(res.body.name).toBe('Alex Student');
      expect(res.body.gcrLink).toBeUndefined();
    });

    it('POST /join/opened records classroom_opened_at', async () => {
      let updateRun = false;
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: null,
                joined_confirmed_at: null,
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        if (sql.includes('UPDATE payments SET classroom_opened_at')) {
          updateRun = true;
          return Promise.resolve({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      const res = await request(app)
        .post('/join/opened')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateRun).toBe(true);
    });

    it('POST /join/confirm rejects if classroom was not opened', async () => {
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: null, // NOT OPENED
                joined_confirmed_at: null,
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      const res = await request(app)
        .post('/join/confirm')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('open Google Classroom before confirming');
    });

    it('POST /join/confirm rejects if confirmed too quickly (< CONFIRM_MIN_SECONDS)', async () => {
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: new Date(), // Just opened 0 seconds ago
                joined_confirmed_at: null,
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      const res = await request(app)
        .post('/join/confirm')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Confirmation available in');
    });

    it('POST /join/confirm sets joined_confirmed_at when delay requirement met', async () => {
      let confirmUpdated = false;
      vi.spyOn(poolModule, 'query').mockImplementation((sql: string) => {
        if (sql.includes('FROM join_sessions')) {
          return Promise.resolve({
            rows: [
              {
                session_id: 'sess-1',
                order_id: 'order-1',
                token_hash: sessionTokenHash,
                expires_at: new Date(Date.now() + 86400000),
                revoked_at: null,
                payment_id: 'pay-1',
                razorpay_order_id: 'order_rzp_1',
                status: 'PAID',
                classroom_opened_at: new Date(Date.now() - 30000), // Opened 30 seconds ago
                joined_confirmed_at: null,
                customer_name: 'Alex Student',
              },
            ],
            rowCount: 1,
            command: '',
            oid: 0,
            fields: [],
          });
        }
        if (sql.includes('UPDATE payments SET joined_confirmed_at')) {
          confirmUpdated = true;
          return Promise.resolve({ rows: [], rowCount: 1, command: '', oid: 0, fields: [] });
        }
        return Promise.resolve({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      });

      const res = await request(app)
        .post('/join/confirm')
        .set('Authorization', `Bearer ${rawSessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("You're all set. Welcome to the course!");
      expect(confirmUpdated).toBe(true);
    });

    it('createSession enforces MAX_SESSIONS_PER_ORDER by revoking oldest', async () => {
      let revokedIds: string[] = [];
      const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('SELECT id FROM join_sessions')) {
          return Promise.resolve({
            rows: [{ id: 'sess-old-1' }, { id: 'sess-old-2' }, { id: 'sess-old-3' }],
          });
        }
        if (sql.includes('UPDATE join_sessions SET revoked_at')) {
          revokedIds = params?.[0] || [];
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO join_sessions')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const token = await joinService.createSession('order-uuid-99', { query: mockQuery });
      expect(token).toBeDefined();
      expect(revokedIds).toContain('sess-old-1');
    });
  });
});

