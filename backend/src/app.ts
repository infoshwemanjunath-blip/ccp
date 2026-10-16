import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, siteOrigins } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { enrollmentRouter } from './routes/enrollmentRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { webhookRouter } from './routes/webhookRoutes.js';
import { joinRouter } from './routes/joinRoutes.js';
import { jobRouter } from './routes/jobRoutes.js';
import { logger } from './utils/logger.js';

export const app = express();

// Trust reverse proxy (Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security Headers with strict no-referrer
app.use(
  helmet({
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS Configuration (supports SITE_URL and FRONTEND_URL)
const allowedOrigins = [
  ...siteOrigins,
  ...(env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/$/, '')) : []),
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
        (env.NODE_ENV === 'development' && (cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1')))
      ) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-job-secret'],
    credentials: true,
  })
);

// RAW body parser for Razorpay webhook route (MUST be above express.json)
app.use(
  ['/api/webhooks/razorpay', '/webhooks/razorpay'],
  express.raw({ type: '*/*', limit: '2mb' }),
  (req: any, _res, next) => {
    if (req.body && Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      try {
        req.body = JSON.parse(req.body.toString('utf8'));
      } catch {
        req.body = {};
      }
    }
    next();
  }
);

// Standard JSON parser for other routes
app.use(
  express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      if (!req.rawBody) req.rawBody = buf;
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
app.use('/webhooks', webhookRouter);

// Join routes (GET /api/join/check, POST /api/join/verify)
app.use('/api/join', joinRouter);
app.use('/join', joinRouter);

// Job routes (POST /api/jobs/retry-invites, POST /jobs/retry-invites)
app.use('/api/jobs', jobRouter);
app.use('/jobs', jobRouter);

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
