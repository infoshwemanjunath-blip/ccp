import { Router, Request, Response } from 'express';
import { verifyPaymentSchema } from '../utils/validation.js';
import { razorpayService } from '../services/razorpayService.js';
import { enrollmentWorkflowService } from '../services/enrollmentWorkflowService.js';
import { verifyLimiter, orderLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const paymentRouter = Router();

/**
 * POST /api/create-order or /api/payment/create-order
 * Standard Razorpay order creation endpoint
 * Request: { amount (paise), currency?, receipt?, notes? }
 * Minimum amount: 100 paise
 */
paymentRouter.post('/create-order', orderLimiter, async (req: Request, res: Response) => {
  try {
    const rawAmount = req.body?.amount;
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Amount is required and must be in paise (minimum 100 paise)',
      });
    }

    const amount = Number(rawAmount);
    if (isNaN(amount) || !Number.isInteger(amount) || amount < 100) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Amount must be an integer >= 100 paise',
      });
    }

    const currency = (req.body.currency || 'INR').toUpperCase();
    const receipt = req.body.receipt || `rcpt_${Date.now()}`;
    const notes = req.body.notes;

    const order = await razorpayService.createStandardOrder({
      amount,
      currency,
      receipt,
      notes,
    });

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

    try {
      await enrollmentWorkflowService.handlePaymentSuccess(order_id, payment_id);
    } catch {
      // Non-blocking for generic checkout
    }

    return res.status(200).json({
      verified: true,
      success: true,
      message: 'Payment verified successfully.',
      order_id,
      payment_id,
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

    // Fast-path enrollment kickoff (idempotent with webhook)
    try {
      await enrollmentWorkflowService.handlePaymentSuccess(
        razorpay_order_id,
        razorpay_payment_id
      );
    } catch (workflowErr) {
      // If payment record lookup or classroom call is pending, webhook will guarantee delivery
      logger.warn('Fast-path enrollment initiation deferred to webhook', {
        orderId: razorpay_order_id,
      });
    }

    return res.status(200).json({
      verified: true,
      message: 'Payment verified. Enrollment is being activated.',
    });
  } catch (error: any) {
    logger.error('Error during payment verification', error);
    return res.status(500).json({
      verified: false,
      error: 'An internal error occurred during payment verification.',
    });
  }
});
