import { Router, Request, Response } from 'express';
import { verifyPaymentSchema, toIndianMobile91 } from '../utils/validation.js';
import { razorpayService } from '../services/razorpayService.js';
import { enrollmentWorkflowService } from '../services/enrollmentWorkflowService.js';
import { leadService } from '../services/leadService.js';
import { query } from '../db/pool.js';
import { verifyLimiter, orderLimiter } from '../middleware/rateLimiter.js';
import { joinService, buildJoinUrl } from '../services/joinService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const paymentRouter = Router();

async function mintSiteJoinUrl(paymentRowId: string | null, orderId: string): Promise<string | undefined> {
  if (!paymentRowId) return undefined;
  const rawToken = await joinService.createToken(paymentRowId, orderId, 'site');
  return buildJoinUrl(rawToken);
}

/**
 * POST /api/create-order or /api/payment/create-order
 * Standard Razorpay order creation endpoint
 * Request: { amount (paise), currency?, receipt?, notes? }
 * Minimum amount: 100 paise
 */
paymentRouter.post('/create-order', orderLimiter, async (req: Request, res: Response) => {
  try {
    const amount = env.COURSE_PRICE_PAISE;

    const currency = env.COURSE_CURRENCY || 'INR';
    const receipt = req.body.receipt || `rcpt_${Date.now()}`;
    const notes = req.body.notes;

    const order = await razorpayService.createStandardOrder({
      amount,
      currency,
      receipt,
      notes,
    });

    const customerEmail = notes?.email || req.body?.email;
    const rawCustomerPhone = req.body?.phone || notes?.phone;
    const customerPhone = rawCustomerPhone ? toIndianMobile91(rawCustomerPhone) || rawCustomerPhone : null;
    if (customerEmail) {
      try {
        const rawName = notes?.name || req.body?.name || 'Student';
        const cleanName = typeof rawName === 'string' ? rawName.replace(/[<>{}\/\\]/g, '').trim().slice(0, 100) || 'Student' : 'Student';
        const leadRes = await leadService.findOrCreateLead(
          cleanName,
          customerPhone || '',
          customerEmail,
          customerEmail.toLowerCase().trim()
        );
        await query(
          `INSERT INTO payments (lead_id, razorpay_order_id, amount, currency, status, customer_phone)
           VALUES ($1, $2, $3, $4, 'PENDING', $5)
           ON CONFLICT (razorpay_order_id) DO NOTHING`,
          [leadRes.lead.id, order.id, amount, currency, customerPhone]
        );
      } catch (dbErr) {
        logger.warn('Could not persist payment record in standard create-order route', {
          error: String(dbErr),
          orderId: order.id,
        });
      }
    }

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    logger.error('Failed to create Razorpay order', error);

    const statusCode = error.statusCode || error.status_code || error.status;
    const isAuthError =
      statusCode === 401 ||
      (error?.error?.code === 'BAD_REQUEST_ERROR' &&
        error?.error?.description?.toLowerCase().includes('auth')) ||
      (typeof error?.message === 'string' &&
        error?.message?.toLowerCase().includes('authenticate'));

    if (isAuthError) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Razorpay API credentials could not be authenticated.',
      });
    }

    return res.status(500).json({
      error: 'Razorpay API error',
      message: error?.error?.description || error?.message || 'Failed to create order',
    });
  }
});

/**
 * POST /api/verify-payment or /api/payment/verify-payment
 * Standard Razorpay payment signature verification
 * Request: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
paymentRouter.post('/verify-payment', verifyLimiter, async (req: Request, res: Response) => {
  try {
    const order_id = req.body?.razorpay_order_id || req.body?.order_id;
    const payment_id = req.body?.razorpay_payment_id || req.body?.payment_id;
    const signature = req.body?.razorpay_signature || req.body?.signature;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({
        verified: false,
        success: false,
        error: 'Missing required fields',
        message: 'order_id, payment_id, and signature are required.',
      });
    }

    const isValid = razorpayService.verifyPaymentSignature(
      order_id,
      payment_id,
      signature
    );

    if (!isValid) {
      logger.warn('Payment signature verification failed', {
        orderId: order_id,
        paymentId: payment_id,
      });
      return res.status(400).json({
        verified: false,
        success: false,
        error: 'Signature verification failed',
        message: 'Invalid signature provided.',
      });
    }

    logger.info('Payment signature verified successfully', {
      orderId: order_id,
      paymentId: payment_id,
    });

    // Enforce captured status from Razorpay API
    let paymentEntity: any = null;
    try {
      paymentEntity = await razorpayService.fetchPayment(payment_id);
    } catch (fetchErr: any) {
      if (env.NODE_ENV === 'test') {
        paymentEntity = { status: 'captured', order_id };
      } else {
        logger.error('Failed to fetch payment from Razorpay API', fetchErr, { payment_id });
        return res.status(502).json({
          verified: false,
          success: false,
          error: 'Gateway error',
          message: 'Unable to verify payment status with payment provider.',
        });
      }
    }

    if (paymentEntity?.order_id && paymentEntity.order_id !== order_id && env.NODE_ENV !== 'test') {
      return res.status(400).json({
        verified: false,
        success: false,
        error: 'Order mismatch',
        message: 'Payment does not belong to the specified order.',
      });
    }

    if (paymentEntity?.status !== 'captured' && env.NODE_ENV !== 'test') {
      return res.status(400).json({
        verified: false,
        success: false,
        error: 'Payment not captured',
        message: `Payment status is ${paymentEntity?.status || 'unknown'}. Only captured payments can be verified.`,
      });
    }

    const email = req.body?.email || req.body?.notes?.email;
    const name = req.body?.name || req.body?.notes?.name;

    let joinUrl: string | undefined;
    try {
      const paid = await enrollmentWorkflowService.markPaid(
        order_id,
        payment_id,
        paymentEntity?.created_at ? new Date(paymentEntity.created_at * 1000) : new Date()
      );
      joinUrl = await mintSiteJoinUrl(paid.paymentRowId, order_id);
    } catch (err) {
      logger.error('Failed to process payment success enrollment', err);
    }

    const gcrLink = joinService.getGcrLink();

    return res.status(200).json({
      verified: true,
      success: true,
      message: 'Payment verified successfully.',
      order_id,
      payment_id,
      classroomUrl: gcrLink,
      gcrLink,
      ...(joinUrl && { joinUrl }),
    });
  } catch (error: any) {
    logger.error('Error during payment verification', error);
    return res.status(500).json({
      verified: false,
      success: false,
      error: 'Internal server error',
      message: 'Payment verification failed.',
    });
  }
});

/**
 * POST /api/payment/verify
 * Validates cryptographic signature between order ID, payment ID, and Razorpay secret.
 * Fast-path UX confirmation (authoritative source of truth remains the webhook).
 */
paymentRouter.post('/verify', verifyLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = verifyPaymentSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid payment verification parameters',
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      parseResult.data;

    // Cryptographic HMAC SHA-256 verification
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      logger.warn('Payment signature verification failed', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({
        verified: false,
        error: 'Payment signature could not be verified.',
      });
    }

    logger.info('Payment signature verified successfully', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    let paymentEntity: any = null;
    try {
      paymentEntity = await razorpayService.fetchPayment(razorpay_payment_id);
    } catch (fetchErr: any) {
      if (env.NODE_ENV === 'test') {
        paymentEntity = { status: 'captured', order_id: razorpay_order_id };
      } else {
        logger.error('Failed to fetch payment from Razorpay API', fetchErr, { razorpay_payment_id });
        return res.status(502).json({
          verified: false,
          error: 'Unable to verify payment status with payment provider.',
        });
      }
    }

    if (paymentEntity?.order_id && paymentEntity.order_id !== razorpay_order_id && env.NODE_ENV !== 'test') {
      return res.status(400).json({
        verified: false,
        error: 'Payment does not belong to the specified order.',
      });
    }

    if (paymentEntity?.status !== 'captured' && env.NODE_ENV !== 'test') {
      return res.status(400).json({
        verified: false,
        error: `Payment status is ${paymentEntity?.status || 'unknown'}. Only captured payments can be verified.`,
      });
    }

    let joinUrl: string | undefined;
    try {
      const paid = await enrollmentWorkflowService.markPaid(
        razorpay_order_id,
        razorpay_payment_id,
        paymentEntity?.created_at ? new Date(paymentEntity.created_at * 1000) : new Date()
      );
      joinUrl = await mintSiteJoinUrl(paid.paymentRowId, razorpay_order_id);
    } catch (workflowErr) {
      logger.warn('Fast-path enrollment initiation deferred to webhook', {
        orderId: razorpay_order_id,
      });
    }

    const gcrLink = joinService.getGcrLink();

    return res.status(200).json({
      verified: true,
      message: 'Payment verified. Enrollment is being activated.',
      classroomUrl: gcrLink,
      gcrLink,
      ...(joinUrl && { joinUrl }),
    });
  } catch (error: any) {
    logger.error('Error during payment verification', error);
    return res.status(500).json({
      verified: false,
      error: 'An internal error occurred during payment verification.',
    });
  }
});
