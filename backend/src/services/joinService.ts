import crypto from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import { env, siteUrl } from '../config/env.js';
import { toIndianMobile91 } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

export type JoinTokenSource = 'site' | 'whatsapp';
export type JoinTokenState = 'valid' | 'expired' | 'invalid' | 'locked' | 'joined';

export type JoinVerifyResult =
  | { ok: true; gcrLink: string; sessionToken: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' | 'mismatch' | 'not_configured' | 'already_joined'; lockedNow?: boolean };

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 60;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,128}$/;

interface TokenRow {
  token_hash: string;
  expires_at: Date;
  order_id: string;
  razorpay_order_id: string;
  status: string;
  join_locked_until: Date | null;
  join_reveal_count: number;
  joined_confirmed_at: Date | null;
}

interface SessionRow {
  session_id: string;
  order_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  payment_id: string;
  razorpay_order_id: string;
  status: string;
  classroom_opened_at: Date | null;
  joined_confirmed_at: Date | null;
  customer_name: string;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function safeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function buildJoinUrl(rawToken: string): string {
  return `${siteUrl}/join/${rawToken}`;
}

function isLocked(lockedUntil: Date | null): boolean {
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

export class JoinService {
  /**
   * Return configured or fallback Google Classroom URL.
   */
  getGcrLink(): string {
    if (env.GCR_LINK) return env.GCR_LINK;
    if (env.GOOGLE_CLASSROOM_COURSE_ID && env.GOOGLE_CLASSROOM_ENROLLMENT_CODE) {
      return `https://classroom.google.com/c/${env.GOOGLE_CLASSROOM_COURSE_ID}?cjc=${env.GOOGLE_CLASSROOM_ENROLLMENT_CODE}`;
    }
    return 'https://classroom.google.com/c/ODkxODYwMDQwMzQw?cjc=435t7z2a';
  }

  /**
   * Create a new join token for a PAID order. Returns the RAW token (never stored, never logged).
   */
  async createToken(paymentRowId: string, razorpayOrderId: string, source: JoinTokenSource): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + env.JOIN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO join_tokens (order_id, token_hash, source, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [paymentRowId, hashToken(rawToken), source, expiresAt]
    );

    logger.info('Join token created', { orderId: razorpayOrderId, source });
    return rawToken;
  }

  /**
   * Create a new join session for an order, enforcing MAX_SESSIONS_PER_ORDER by revoking oldest.
   */
  async createSession(orderId: string, client?: any): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + env.JOIN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const runQuery = client ? (t: string, p: any[]) => client.query(t, p) : query;

    // Enforce MAX_SESSIONS_PER_ORDER by revoking oldest active sessions
    const activeRes = await runQuery(
      `SELECT id FROM join_sessions
        WHERE order_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at ASC`,
      [orderId]
    );

    const activeRows = activeRes.rows || [];
    const maxSessions = env.MAX_SESSIONS_PER_ORDER;
    if (activeRows.length >= maxSessions) {
      const revokeCount = activeRows.length - maxSessions + 1;
      const idsToRevoke = activeRows.slice(0, revokeCount).map((r: any) => r.id);
      if (idsToRevoke.length > 0) {
        await runQuery(
          `UPDATE join_sessions SET revoked_at = NOW() WHERE id = ANY($1::uuid[])`,
          [idsToRevoke]
        );
      }
    }

    await runQuery(
      `INSERT INTO join_sessions (order_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [orderId, tokenHash, expiresAt]
    );

    console.log('[JOIN] join session created', { orderId });
    logger.info('Join session created', { orderId });
    return rawToken;
  }

  /**
   * Fetch and validate session by rawToken.
   */
  private async getSession(rawToken: string): Promise<SessionRow | null> {
    if (!rawToken || !TOKEN_FORMAT.test(rawToken)) {
      console.log('[JOIN] session rejected', { reason: 'malformed_token' });
      return null;
    }

    const tokenHash = hashToken(rawToken);

    const res = await query<SessionRow>(
      `SELECT s.id AS session_id, s.order_id, s.token_hash, s.expires_at, s.revoked_at,
              p.id AS payment_id, p.razorpay_order_id, p.status, p.classroom_opened_at, p.joined_confirmed_at,
              COALESCE(p.customer_name_submitted, l.full_name, 'Student') AS customer_name
         FROM join_sessions s
         JOIN payments p ON p.id = s.order_id
         LEFT JOIN leads l ON l.id = p.lead_id
        WHERE s.token_hash = $1
        LIMIT 1`,
      [tokenHash]
    );

    const row = res.rows[0];
    if (!row) {
      console.log('[JOIN] session rejected', { reason: 'not_found' });
      return null;
    }

    if (row.revoked_at !== null) {
      console.log('[JOIN] session rejected', { reason: 'revoked' });
      return null;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      console.log('[JOIN] session rejected', { reason: 'expired' });
      return null;
    }

    if (!safeEqualStr(row.token_hash.trim(), tokenHash)) {
      console.log('[JOIN] session rejected', { reason: 'hash_mismatch' });
      return null;
    }

    // Touch last_seen_at
    query(`UPDATE join_sessions SET last_seen_at = NOW() WHERE id = $1`, [row.session_id]).catch(() => {});

    return row;
  }

  private async findToken(rawToken: string): Promise<TokenRow | null> {
    if (!rawToken || !TOKEN_FORMAT.test(rawToken)) return null;
    const hash = hashToken(rawToken);

    const res = await query<TokenRow>(
      `SELECT jt.token_hash, jt.expires_at, jt.order_id,
              p.razorpay_order_id, p.status, p.join_locked_until, p.join_reveal_count, p.joined_confirmed_at
         FROM join_tokens jt
         JOIN payments p ON p.id = jt.order_id
        WHERE jt.token_hash = $1
        LIMIT 1`,
      [hash]
    );

    const row = res.rows[0];
    if (!row || !safeEqualStr(row.token_hash.trim(), hash)) return null;
    return row;
  }

  private stateOf(row: TokenRow | null): JoinTokenState {
    if (!row || row.status !== 'PAID') return 'invalid';
    if (Boolean(row.joined_confirmed_at)) return 'joined';
    if (new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
    if (isLocked(row.join_locked_until)) return 'locked';
    if (row.join_reveal_count >= env.MAX_REVEALS) return 'locked';
    return 'valid';
  }

  /** GET /api/join/check — returns only the token state */
  async checkToken(rawToken: string): Promise<JoinTokenState> {
    return this.stateOf(await this.findToken(rawToken));
  }

  /**
   * POST /api/join/verify — phone must match the paid phone on the order.
   * On success: creates a session and returns { gcrLink, sessionToken }.
   */
  async verify(rawToken: string, name: string, email: string, typedPhone91: string): Promise<JoinVerifyResult> {
    const tokenRow = await this.findToken(rawToken);
    const tokenState = this.stateOf(tokenRow);
    if (!tokenRow || tokenState === 'invalid' || tokenState === 'expired') {
      return { ok: false, reason: tokenState === 'expired' ? 'expired' : 'invalid' };
    }

    if (Boolean(tokenRow.joined_confirmed_at)) {
      return { ok: false, reason: 'already_joined' };
    }

    return withTransaction(async (client) => {
      // Lock the order row so concurrent attempts can't bypass the failure/reveal counters
      const orderRes = await client.query(
        `SELECT p.id, p.razorpay_order_id, p.status, p.customer_phone, p.join_failed_attempts,
                p.join_locked_until, p.join_reveal_count, p.joined_confirmed_at, l.phone AS lead_phone
           FROM payments p
           LEFT JOIN leads l ON l.id = p.lead_id
          WHERE p.id = $1
          FOR UPDATE OF p`,
        [tokenRow.order_id]
      );
      const order = orderRes.rows[0];
      const orderId: string = order?.razorpay_order_id;

      if (!order || order.status !== 'PAID') return { ok: false, reason: 'invalid' } as const;
      if (Boolean(order.joined_confirmed_at)) return { ok: false, reason: 'already_joined' } as const;
      if (isLocked(order.join_locked_until) || order.join_reveal_count >= env.MAX_REVEALS) {
        return { ok: false, reason: 'locked' } as const;
      }

      // Paid phone: per-order snapshot, falling back to the lead's phone for older rows
      const paidPhone = order.customer_phone || toIndianMobile91(order.lead_phone);
      const matches = Boolean(paidPhone) && safeEqualStr(paidPhone, typedPhone91);

      if (!matches) {
        const failures = (order.join_failed_attempts || 0) + 1;
        if (failures >= MAX_FAILED_ATTEMPTS) {
          await client.query(
            `UPDATE payments
                SET join_failed_attempts = 0,
                    join_locked_until = NOW() + ($1 || ' minutes')::INTERVAL
              WHERE id = $2`,
            [String(LOCK_MINUTES), order.id]
          );
          logger.warn('Join phone mismatch', { orderId, failures });
          logger.warn('Join access locked for order', { orderId, lockMinutes: LOCK_MINUTES });
          return { ok: false, reason: 'mismatch', lockedNow: true } as const;
        }

        await client.query(`UPDATE payments SET join_failed_attempts = $1 WHERE id = $2`, [failures, order.id]);
        logger.warn('Join phone mismatch', { orderId, failures });
        return { ok: false, reason: 'mismatch' } as const;
      }

      await client.query(
        `UPDATE payments
            SET customer_name_submitted = $1,
                customer_email_submitted = $2,
                join_reveal_count = join_reveal_count + 1
          WHERE id = $3`,
        [name, email, order.id]
      );

      const sessionToken = await this.createSession(order.id, client);
      logger.info('Join success', { orderId, revealCount: order.join_reveal_count + 1 });
      const gcrLink = this.getGcrLink();

      return { ok: true, gcrLink, sessionToken } as const;
    });
  }

  /**
   * GET /api/join/status — returns { state: "pending" | "joined", name, gcrLink? }
   */
  async getStatus(rawToken: string): Promise<
    | { ok: true; state: 'pending'; name: string; gcrLink: string }
    | { ok: true; state: 'joined'; name: string }
    | { ok: false; error: string }
  > {
    const session = await this.getSession(rawToken);
    if (!session) {
      return { ok: false, error: 'Invalid or expired session' };
    }

    if (session.joined_confirmed_at !== null) {
      return { ok: true, state: 'joined', name: session.customer_name };
    }

    return {
      ok: true,
      state: 'pending',
      name: session.customer_name,
      gcrLink: this.getGcrLink(),
    };
  }

  /**
   * POST /api/join/opened — records when customer opened Google Classroom
   */
  async recordClassroomOpened(rawToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await this.getSession(rawToken);
    if (!session) {
      return { ok: false, error: 'Invalid or expired session' };
    }

    if (!session.classroom_opened_at) {
      await query(
        `UPDATE payments SET classroom_opened_at = NOW() WHERE id = $1 AND classroom_opened_at IS NULL`,
        [session.payment_id]
      );
      console.log('[JOIN] classroom opened', { orderId: session.razorpay_order_id });
      logger.info('Classroom opened', { orderId: session.razorpay_order_id });
    }

    return { ok: true };
  }

  /**
   * POST /api/join/confirm — confirms customer joined the classroom
   */
  async confirmJoin(rawToken: string): Promise<
    | { ok: true; message: string; alreadyConfirmed?: boolean }
    | { ok: false; error: string; unauthorized?: boolean }
  > {
    const session = await this.getSession(rawToken);
    if (!session) {
      return { ok: false, unauthorized: true, error: 'Invalid or expired session' };
    }

    if (session.joined_confirmed_at !== null) {
      return { ok: true, alreadyConfirmed: true, message: "You're all set. Welcome to the course!" };
    }

    if (!session.classroom_opened_at) {
      return { ok: false, error: 'Please open Google Classroom before confirming.' };
    }

    const elapsedSec = (Date.now() - new Date(session.classroom_opened_at).getTime()) / 1000;
    const minSeconds = env.CONFIRM_MIN_SECONDS;
    if (elapsedSec < minSeconds) {
      const remaining = Math.ceil(minSeconds - elapsedSec);
      return { ok: false, error: `Please join in Classroom first. Confirmation available in ${remaining}s.` };
    }

    await query(
      `UPDATE payments SET joined_confirmed_at = NOW() WHERE id = $1`,
      [session.payment_id]
    );

    console.log('[JOIN] join confirmed', { orderId: session.razorpay_order_id });
    logger.info('Join confirmed', { orderId: session.razorpay_order_id });
    return { ok: true, message: "You're all set. Welcome to the course!" };
  }
}

export const joinService = new JoinService();
