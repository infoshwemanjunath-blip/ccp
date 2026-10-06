import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  PORT: z.string().default('5000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: isProd
    ? z.string().min(1, 'DATABASE_URL is required in production')
    : z.string().default('postgresql://postgres:postgres@localhost:5432/postgres'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Razorpay
  RAZORPAY_KEY_ID: isProd
    ? z.string().min(1, 'RAZORPAY_KEY_ID is required in production')
    : z.string().default('rzp_test_mock_key_id'),
  RAZORPAY_KEY_SECRET: isProd
    ? z.string().min(1, 'RAZORPAY_KEY_SECRET is required in production')
    : z.string().default('mock_secret_key_12345'),
  RAZORPAY_WEBHOOK_SECRET: isProd
    ? z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required in production')
    : z.string().default('mock_webhook_secret_67890'),
  COURSE_PRICE_PAISE: z.string().default('349900').transform((v) => parseInt(v, 10)),
  COURSE_CURRENCY: z.string().default('INR'),

  // Google Classroom
  GOOGLE_CLIENT_ID: z.string().default('mock_google_client_id'),
  GOOGLE_CLIENT_SECRET: z.string().default('mock_google_client_secret'),
  GOOGLE_REFRESH_TOKEN: z.string().default('mock_google_refresh_token'),
  GOOGLE_CLASSROOM_COURSE_ID: z.string().default('mock_classroom_course_123'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('CRITICAL: Environment validation failed:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
