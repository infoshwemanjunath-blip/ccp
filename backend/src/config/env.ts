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
  COURSE_PRICE_PAISE: z.coerce.number().default(100),
  COURSE_CURRENCY: z.string().default('INR'),

  // Google Classroom
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REFRESH_TOKEN: z.string().default(''),
  GOOGLE_CLASSROOM_COURSE_ID: z.string().default(''),
  GOOGLE_CLASSROOM_ENROLLMENT_CODE: z.string().default(''),
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

  // Supabase (optional here: DB access goes through DATABASE_URL / pg pool)
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // Personal join page (phone-matched GCR link reveal) & join sessions
  GCR_LINK: z.string().default(''),
  SITE_URL: z.string().default(''),
  JOIN_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MAX_REVEALS: z.coerce.number().int().positive().default(3),
  CONFIRM_MIN_SECONDS: z.coerce.number().int().nonnegative().default(15),
  JOIN_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MAX_SESSIONS_PER_ORDER: z.coerce.number().int().positive().default(3),

  // WhatsApp (WaAPI)
  SEND_WHATSAPP: z
    .preprocess((val) => (val === undefined || val === '' ? true : val === 'true' || val === true), z.boolean())
    .default(true),
  WAAPI_TOKEN: z.string().default(''),
  WAAPI_INSTANCE_ID: z.string().default(''),

  // Protects POST /api/jobs/retry-invites
  JOB_SECRET: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('CRITICAL: Environment validation failed:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

/**
 * Browser origins allowed by CORS. SITE_URL may be comma-separated
 * (e.g. "https://superprofit.in,https://www.superprofit.in"); the first entry is the
 * canonical base used for join links. Falls back to the existing FRONTEND_URL.
 */
export const siteOrigins: string[] = (env.SITE_URL || env.FRONTEND_URL)
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const siteUrl: string = siteOrigins[0] || '';
