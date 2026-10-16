import { z } from 'zod';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeIndianPhone(phone: string): string {
  // Strip all whitespace, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Handle +91 or 91 prefix
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizeIndianPhone(phone);
  // Valid Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Normalize any Indian mobile input to "91XXXXXXXXXX" (WhatsApp/E.164 digits without '+').
 * Accepts "98765 43210", "+91 98765-43210", "09876543210", "919876543210".
 * Returns null for anything that is not a valid Indian mobile number.
 */
export function toIndianMobile91(input: unknown): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const createOrderSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .refine((val) => !/[<>{}\/\\]/.test(val), {
      message: 'Name contains invalid characters',
    }),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .refine(isValidIndianPhone, {
      message: 'Invalid Indian phone number. Must be a 10-digit mobile number.',
    })
    .transform(normalizeIndianPhone),
  email: z
    .string({ required_error: 'Google account email is required' })
    .trim()
    .email('Invalid email syntax')
    .transform(normalizeEmail),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
});

export const updateGoogleEmailSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  email: z
    .string({ required_error: 'Google account email is required' })
    .trim()
    .email('Invalid email syntax')
    .transform(normalizeEmail),
});

export const joinVerifySchema = z.object({
  token: z.string().trim().min(20).max(128),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email syntax')
    .max(255)
    .transform(normalizeEmail),
  phone: z.string({ required_error: 'Phone number is required' }).trim().max(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type UpdateGoogleEmailInput = z.infer<typeof updateGoogleEmailSchema>;
export type JoinVerifyInput = z.infer<typeof joinVerifySchema>;
