export interface LogMeta {
  leadId?: string;
  orderId?: string;
  paymentId?: string;
  eventId?: string;
  email?: string;
  status?: string;
  [key: string]: any;
}

function maskEmail(email?: string): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const maskedUser = user.length > 2 ? `${user.substring(0, 2)}***` : '***';
  return `${maskedUser}@${domain}`;
}

function sanitizeMeta(meta?: LogMeta): LogMeta {
  if (!meta) return {};
  const sanitized = { ...meta };
  if (sanitized.email) {
    sanitized.email = maskEmail(sanitized.email);
  }
  // Strip any accidental secret keys
  delete sanitized.keySecret;
  delete sanitized.webhookSecret;
  delete sanitized.clientSecret;
  delete sanitized.refreshToken;
  delete sanitized.signature;
  return sanitized;
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeMeta(meta),
      })
    );
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeMeta(meta),
      })
    );
  },
  error(message: string, err?: any, meta?: LogMeta) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        error: err instanceof Error ? err.message : String(err),
        ...sanitizeMeta(meta),
      })
    );
  },
};
