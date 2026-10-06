import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { retryWorker } from './services/retryWorker.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`Server listening securely on port ${PORT}`, {
    port: String(PORT),
    env: env.NODE_ENV,
  });

  // Start background retry worker for resilient Google Classroom handling
  retryWorker.start(30000);
});

// Graceful Shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  retryWorker.stop();
  server.close(async () => {
    logger.info('HTTP server closed.');
    await pool.end();
    logger.info('Database pool closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

