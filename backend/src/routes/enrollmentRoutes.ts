import { Router, Request, Response } from 'express';
import { createOrderSchema, updateGoogleEmailSchema } from '../utils/validation.js';
import { leadService } from '../services/leadService.js';
import { razorpayService } from '../services/razorpayService.js';
import { enrollmentWorkflowService } from '../services/enrollmentWorkflowService.js';
import { googleClassroomService } from '../services/googleClassroomService.js';
import { orderLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';

export const enrollmentRouter = Router();

/**
 * POST /api/enrollment/create-order
 * Validates lead, normalizes email, checks access, creates Razorpay order server-side
 */
enrollmentRouter.post('/create-order', orderLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = createOrderSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, phone, email } = parseResult.data;

    // 1. Create or retrieve lead record (with fallback if DB offline)
    let lead: any = null;
    let alreadyEnrolled = false;

    try {
      const leadResult = await leadService.findOrCreateLead(
        name,
        phone,
        email,
        email // email is already normalized by zod schema
      );
      lead = leadResult.lead;
      alreadyEnrolled = leadResult.alreadyEnrolled;
    } catch (dbErr) {
      logger.warn('Database offline, proceeding with checkout session', { email });
      lead = {
        id: `lead_${Date.now()}`,
        full_name: name,
        phone,
        email,
        email_normalized: email,
        payment_status: 'PENDING',
        enrollment_status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    // 2. Prevent unnecessary checkout if already enrolled
    if (alreadyEnrolled) {
      return res.status(200).json({
        alreadyEnrolled: true,
        message: 'Your Google account already has active enrollment in this course.',
      });
    }

    // 3. Create Razorpay order server-side
    const checkoutData = await razorpayService.createOrder(lead);

    // 4. Update lead with latest order ID (graceful if DB offline)
    try {
      if (lead?.id && !lead.id.startsWith('lead_')) {
        await leadService.updateLatestOrder(lead.id, checkoutData.orderId);
      }
    } catch (dbErr) {
      logger.warn('Could not update lead order in DB (proceeding)', {
        error: String(dbErr),
      });
    }

    // 5. Return ONLY public checkout parameters (never secrets)
    return res.status(200).json({
      alreadyEnrolled: false,
      ...checkoutData,
    });
  } catch (error: any) {
    logger.error('Error creating enrollment order', error);
    return res.status(500).json({
      error: 'Failed to initiate order. Please try again.',
    });
  }
});

/**
 * GET /api/enrollment/status/:orderId
 * Clean status polling endpoint without leaking internal IDs or secrets
 */
enrollmentRouter.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    try {
      const status = await leadService.getStatusByOrderId(orderId);
      if (status) {
        return res.status(200).json(status);
      }
    } catch (err) {
      logger.error('Database error during status lookup', err);
      // Fallback when DB is offline
      return res.status(200).json({
        orderId,
        status: 'ENROLLMENT_PENDING',
        message: 'Status check pending. Please wait...',
      });
    }

    return res.status(404).json({
      orderId,
      status: 'NOT_FOUND',
      message: 'Order not found.',
    });
  } catch (error: any) {
    logger.error('Error checking enrollment status', error, { orderId: req.params.orderId });
    return res.status(500).json({
      error: 'Unable to check status. Please check again shortly.',
    });
  }
});

/**
 * POST /api/enrollment/update-google-email
 * Allows a paid user with an invalid/non-Google email to update their Google email address
 */
enrollmentRouter.post('/update-google-email', async (req: Request, res: Response) => {
  try {
    const parseResult = updateGoogleEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { orderId, email } = parseResult.data;
    const updatedLead = await leadService.updateGoogleEmail(orderId, email);

    // Re-trigger enrollment workflow with updated Google email
    await enrollmentWorkflowService.enqueueClassroomInvite(updatedLead, orderId);

    return res.status(200).json({
      success: true,
      message: 'Google email updated. Classroom invitation dispatched.',
    });
  } catch (error: any) {
    logger.error('Failed to update Google email', error);
    return res.status(400).json({
      error: error.message || 'Failed to update Google account email',
    });
  }
});

/**
 * GET /api/enrollment/google-auth
 * Redirects student directly to Google Classroom course page
 */
enrollmentRouter.get('/google-auth', async (req: Request, res: Response) => {
  const courseId = env.GOOGLE_CLASSROOM_COURSE_ID;
  return res.redirect(`https://classroom.google.com/c/${courseId}`);
});

/**
 * GET /api/enrollment/google-callback
 * Redirects student directly to Google Classroom course page
 */
enrollmentRouter.get('/google-callback', async (req: Request, res: Response) => {
  const courseId = env.GOOGLE_CLASSROOM_COURSE_ID;
  return res.redirect(`https://classroom.google.com/c/${courseId}`);
});


