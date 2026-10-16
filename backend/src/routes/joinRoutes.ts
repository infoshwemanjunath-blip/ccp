import { Router, Request, Response } from 'express';
import { joinService } from '../services/joinService.js';
import { joinVerifySchema, toIndianMobile91 } from '../utils/validation.js';
import {
  joinCheckLimiter,
  joinVerifyLimiter,
  joinStatusLimiter,
  joinOpenedLimiter,
  joinConfirmLimiter,
} from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

export const joinRouter = Router();

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * GET /api/join/check?token=...
 * Returns only the token state: valid / expired / invalid / locked / joined
 */
joinRouter.get('/check', joinCheckLimiter, async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return res.status(400).json({ state: 'invalid', message: 'Token query parameter is required.' });
    }

    const state = await joinService.checkToken(token);
    return res.status(200).json({ state });
  } catch (error: any) {
    logger.error('Error during join check', error);
    return res.status(500).json({ state: 'invalid', error: 'Unable to check token status.' });
  }
});

/**
 * POST /api/join/verify
 * Body: { token, name, email, phone }
 * Matches typed phone against paid phone. On success returns { success: true, gcrLink, sessionToken }.
 */
joinRouter.post('/verify', joinVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = joinVerifySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data. Please check name, email, and phone number.',
      });
    }

    const { token, name, email, phone } = parseResult.data;
    const typedPhone91 = toIndianMobile91(phone);

    if (!typedPhone91) {
      return res.status(400).json({
        success: false,
        error: "Details don't match. Please check your information and try again.",
      });
    }

    const result = await joinService.verify(token, name, email, typedPhone91);

    if (result.ok) {
      return res.status(200).json({
        success: true,
        gcrLink: result.gcrLink,
        sessionToken: result.sessionToken,
      });
    }

    if (result.reason === 'already_joined') {
      return res.status(200).json({
        success: false,
        alreadyJoined: true,
        message: "You've already joined the Classroom.",
      });
    }

    if (result.reason === 'locked') {
      return res.status(403).json({
        success: false,
        error: 'Join access for this order is temporarily locked or maximum reveals reached.',
        locked: true,
      });
    }

    if (result.reason === 'expired') {
      return res.status(410).json({
        success: false,
        error: 'This join invitation has expired.',
      });
    }

    if (result.reason === 'not_configured') {
      return res.status(503).json({
        success: false,
        error: 'Course join link is not configured on the server. Please contact support.',
      });
    }

    // Generic mismatch response — never reveal whether it was phone/email/name or what paid phone is
    return res.status(400).json({
      success: false,
      error: "Details don't match. Please check your information and try again.",
      ...(result.lockedNow && { locked: true }),
    });
  } catch (error: any) {
    logger.error('Error during join verify', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during verification. Please try again.',
    });
  }
});

/**
 * GET /api/join/status
 * Header: Authorization: Bearer <sessionToken>
 * Returns { state: "pending" | "joined", name, gcrLink? }
 */
joinRouter.get('/status', joinStatusLimiter, async (req: Request, res: Response) => {
  try {
    const sessionToken = getBearerToken(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing or invalid authorization session token.' });
    }

    const result = await joinService.getStatus(sessionToken);
    if (!result.ok) {
      return res.status(401).json({ error: result.error });
    }

    if (result.state === 'joined') {
      return res.status(200).json({
        state: 'joined',
        name: result.name,
      });
    }

    return res.status(200).json({
      state: 'pending',
      name: result.name,
      gcrLink: result.gcrLink,
    });
  } catch (error: any) {
    logger.error('Error during join status check', error);
    return res.status(500).json({ error: 'Unable to check join session status.' });
  }
});

/**
 * POST /api/join/opened
 * Header: Authorization: Bearer <sessionToken>
 * Marks orders.classroom_opened_at if not already set
 */
joinRouter.post('/opened', joinOpenedLimiter, async (req: Request, res: Response) => {
  try {
    const sessionToken = getBearerToken(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing or invalid authorization session token.' });
    }

    const result = await joinService.recordClassroomOpened(sessionToken);
    if (!result.ok) {
      return res.status(401).json({ error: result.error });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Error recording classroom opened', error);
    return res.status(500).json({ error: 'Failed to record classroom open event.' });
  }
});

/**
 * POST /api/join/confirm
 * Header: Authorization: Bearer <sessionToken>
 * Requires classroom_opened_at to be set and at least CONFIRM_MIN_SECONDS old
 */
joinRouter.post('/confirm', joinConfirmLimiter, async (req: Request, res: Response) => {
  try {
    const sessionToken = getBearerToken(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing or invalid authorization session token.' });
    }

    const result = await joinService.confirmJoin(sessionToken);
    if (!result.ok) {
      const status = result.unauthorized ? 401 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  } catch (error: any) {
    logger.error('Error confirming classroom join', error);
    return res.status(500).json({ error: 'Failed to confirm classroom join.' });
  }
});
