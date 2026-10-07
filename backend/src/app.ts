import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { enrollmentRouter } from './routes/enrollmentRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { webhookRouter } from './routes/webhookRoutes.js';
import { logger } from './utils/logger.js';

export const app = express();

// Trust reverse proxy (Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS Configuration
const configuredOrigins = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/$/, ''))
  : [];

const allowedOrigins = [
  ...configuredOrigins,
  'https://superprofit.in',
  'https://www.superprofit.in',
  'http://superprofit.in',
  'http://www.superprofit.in',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.includes('superprofit.in') ||
        env.NODE_ENV === 'development'
      ) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
    credentials: true,
  })
);

// Capture raw body for cryptographic webhook HMAC verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Global Rate Limiting
app.use(globalLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/enrollment', enrollmentRouter);
app.use('/api/payment', paymentRouter);
app.use('/api', paymentRouter);
app.use('/api/webhooks', webhookRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Error Handler (Never expose stack traces in production)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled server error', err);
  const isDev = env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal Server Error',
    ...(isDev && { stack: err.stack }),
  });
});
