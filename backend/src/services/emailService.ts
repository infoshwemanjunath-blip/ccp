import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface SendClassroomEmailOptions {
  toEmail: string;
  fullName?: string;
  courseId: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!env.SMTP_HOST || !env.SMTP_USER) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }

    return this.transporter;
  }

  /**
   * Send direct classroom invite link to the student email
   */
  async sendClassroomAccessEmail(options: SendClassroomEmailOptions): Promise<boolean> {
    const { toEmail, fullName, courseId } = options;
    const directClassroomUrl = `https://classroom.google.com/c/${courseId}`;

    logger.info('Preparing classroom access email', { email: toEmail });

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.info('SMTP not configured - simulated email dispatch', {
        email: toEmail,
        directUrl: directClassroomUrl,
      });
      return true;
    }

    const recipientName = fullName ? fullName.trim() : 'Student';

    const mailOptions = {
      from: env.EMAIL_FROM,
      to: toEmail,
      subject: 'Welcome to Super Profit Masterclass — Invitation Sent to Google Classroom',
      text: `Hello ${recipientName},

Thank you for your enrollment in the Super Profit Masterclass!

Your payment has been verified, and an invitation has been sent to your Google account (${toEmail}).

Instruction:
Open Classroom and click Accept.

Direct Classroom Link:
${directClassroomUrl}

Important:
1. Make sure you are signed in to Google with this email: ${toEmail}
2. Open Google Classroom and click Accept to access all class materials.

Need help? Reply directly to this email.

Best regards,
Super Profit Team`,
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #fafaf9; border-radius: 12px; border: 1px solid #e7e5e4;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #064e3b; margin: 0; font-size: 24px; font-weight: 700;">Super Profit Masterclass</h1>
    <p style="color: #78716c; margin-top: 4px; font-size: 14px;">Official Enrollment Confirmation</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e7e5e4; line-height: 1.6;">
    <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Welcome, ${recipientName}!</h2>
    <p>Your payment has been verified, and your invitation has been sent to <strong style="color: #064e3b;">${toEmail}</strong>.</p>
    <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #064e3b;">
        Open Classroom and click Accept to join the course.
      </p>
    </div>
    <div style="margin: 28px 0; text-align: center;">
      <a href="${directClassroomUrl}" target="_blank" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        Open Google Classroom
      </a>
    </div>
    <div style="background: #f5f5f4; padding: 16px; border-radius: 6px; font-size: 13px; color: #57534e;">
      <strong>Important Reminders:</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px;">
        <li>Ensure you are signed into Google with: <strong>${toEmail}</strong></li>
        <li>Open Classroom and click <strong>Accept</strong> on the course invitation card.</li>
      </ul>
    </div>
  </div>
  <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #a8a29e;">
    &copy; ${new Date().getFullYear()} Super Profit. All rights reserved.
  </div>
</div>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info('Classroom access email dispatched successfully', { email: toEmail });
      return true;
    } catch (err: any) {
      logger.error('Failed to send classroom access email', err, { email: toEmail });
      return false;
    }
  }
}

export const emailService = new EmailService();
