import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  createOrderSchema,
  normalizeEmail,
  normalizeIndianPhone,
  isValidIndianPhone,
} from '../src/utils/validation.js';
import { razorpayService } from '../src/services/razorpayService.js';
import { googleClassroomService } from '../src/services/googleClassroomService.js';
import { env } from '../src/config/env.js';

describe('Validation Unit Tests', () => {
  it('should normalize emails properly (lowercase & trim)', () => {
    expect(normalizeEmail('  Student.Creator@GMAIL.COM ')).toBe('student.creator@gmail.com');
    expect(normalizeEmail('JOHN@workspace.edu')).toBe('john@workspace.edu');
  });

  it('should validate and normalize Indian phone numbers', () => {
    // 10-digit mobile
    expect(isValidIndianPhone('9876543210')).toBe(true);
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210');

    // With +91
    expect(isValidIndianPhone('+91 9876543210')).toBe(true);
    expect(normalizeIndianPhone('+91 9876543210')).toBe('9876543210');

    // With leading 0
    expect(isValidIndianPhone('09876543210')).toBe(true);
    expect(normalizeIndianPhone('09876543210')).toBe('9876543210');

    // With 91 prefix
    expect(isValidIndianPhone('919876543210')).toBe(true);
    expect(normalizeIndianPhone('919876543210')).toBe('9876543210');

    // Invalid phones
    expect(isValidIndianPhone('1234567890')).toBe(false); // starts with 1
    expect(isValidIndianPhone('98765')).toBe(false); // too short
    expect(isValidIndianPhone('abcdefghij')).toBe(false); // non-numeric
  });

  it('should successfully parse valid lead registration input', () => {
    const input = {
      name: '  Rahul Sharma  ',
      phone: '+91 98765 43210',
      email: 'Rahul.Sharma@Gmail.com  ',
    };

    const res = createOrderSchema.safeParse(input);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe('Rahul Sharma');
      expect(res.data.phone).toBe('9876543210');
      expect(res.data.email).toBe('rahul.sharma@gmail.com');
    }
  });

  it('should reject invalid email, phone, or name', () => {
    // Invalid email
    const res1 = createOrderSchema.safeParse({
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'not-an-email',
    });
    expect(res1.success).toBe(false);

    // Invalid phone
    const res2 = createOrderSchema.safeParse({
      name: 'Rahul Sharma',
      phone: '12345',
      email: 'rahul@gmail.com',
    });
    expect(res2.success).toBe(false);

    // Injection attempt in name
    const res3 = createOrderSchema.safeParse({
      name: '<script>alert(1)</script>',
      phone: '9876543210',
      email: 'rahul@gmail.com',
    });
    expect(res3.success).toBe(false);
  });
});

describe('Razorpay Signature Cryptography Tests', () => {
  const orderId = 'order_test_12345';
  const paymentId = 'pay_test_67890';
  const secret = env.RAZORPAY_KEY_SECRET;

  it('should verify genuine payment signature', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const result = razorpayService.verifyPaymentSignature(
      orderId,
      paymentId,
      validSignature
    );
    expect(result).toBe(true);
  });

  it('should reject tampered payment signature or mismatched ids', () => {
    const forgedSignature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      razorpayService.verifyPaymentSignature(orderId, paymentId, forgedSignature)
    ).toBe(false);

    // Tampered payment id
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      razorpayService.verifyPaymentSignature(orderId, 'pay_tampered', validSignature)
    ).toBe(false);
  });

  it('should verify webhook HMAC signature against raw body payload', () => {
    const payload = JSON.stringify({
      event: 'order.paid',
      id: 'evt_123',
    });
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    expect(razorpayService.verifyWebhookSignature(payload, signature)).toBe(true);
    expect(razorpayService.verifyWebhookSignature(payload, 'invalid_sig')).toBe(false);
  });
});

describe('Google Classroom Resilience & Error Handling Tests', () => {
  it('should accurately classify transient vs permanent errors', () => {
    expect(googleClassroomService.isTransientError({ status: 429 })).toBe(true);
    expect(googleClassroomService.isTransientError({ status: 500 })).toBe(true);
    expect(googleClassroomService.isTransientError({ status: 502 })).toBe(true);
    expect(googleClassroomService.isTransientError({ status: 503 })).toBe(true);
    expect(googleClassroomService.isTransientError({ status: 504 })).toBe(true);

    // Non-transient errors
    expect(googleClassroomService.isTransientError({ status: 400 })).toBe(false);
    expect(googleClassroomService.isTransientError({ status: 404 })).toBe(false);
    expect(googleClassroomService.isTransientError({ status: 403 })).toBe(false);
  });
});
