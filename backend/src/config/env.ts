import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .optional()
    .default('postgresql://postgres:postgres@localhost:5432/postgres'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  COURSE_PRICE_PAISE: z.coerce.number().default(349900),
  COURSE_CURRENCY: z.string().default('INR'),

  // Google Classroom
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().default(''),
  GOOGLE_CLASSROOM_COURSE_ID: z.string().default(''),
  GOOGLE_CLASSROOM_ENROLLMENT_CODE: z.string().default('u5d3zmob'),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:5000/api/enrollment/google-callback'),

  // Feature Flags
  AUTO_CLASSROOM_ENROLLMENT_ENABLED: z
    .preprocess((val) => (val === undefined ? true : val === 'true' || val === true), z.boolean())
    .default(true),

  // Email Configuration (SMTP)
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .preprocess((val) => (val === undefined ? false : val === 'true' || val === true), z.boolean())
    .default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('Super Profit <support@superprofit.app>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('CRITICAL: Environment validation failed:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
