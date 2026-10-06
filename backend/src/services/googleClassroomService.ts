import { google, classroom_v1 } from 'googleapis';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { logger } from '../utils/logger.js';

export interface EnrollmentResult {
  success: boolean;
  status: 'ENROLLED' | 'FAILED';
  googleUserId?: string;
  invitationId?: string;
  errorCode?: string;
  errorMessage?: string;
  isTransient?: boolean;
}

export interface RemovalResult {
  success: boolean;
  status: 'REMOVED' | 'REMOVAL_PENDING';
  errorCode?: string;
  errorMessage?: string;
  isTransient?: boolean;
}

export class GoogleClassroomService {
  private classroomClient: classroom_v1.Classroom | null = null;

  private getClient(): classroom_v1.Classroom {
    if (!this.classroomClient) {
      const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
      });

      this.classroomClient = google.classroom({
        version: 'v1',
        auth: oauth2Client,
      });
    }

    return this.classroomClient;
  }

  /**
   * Check if an error code or HTTP status is transient (retryable)
   */
  isTransientError(error: any): boolean {
    const status = error?.status || error?.code || error?.response?.status;
    return [429, 500, 502, 503, 504].includes(Number(status));
  }

  /**
   * Invite student to private Google Classroom course using normalized paid email
   */
  async enrollStudent(
    leadId: string,
    emailNormalized: string,
    courseId: string = env.GOOGLE_CLASSROOM_COURSE_ID
  ): Promise<EnrollmentResult> {
    const client = this.getClient();

    try {
      logger.info('Starting Google Classroom enrollment attempt', {
        leadId,
        email: emailNormalized,
      });

      // 1. Check if already a student in the course
      try {
        const studentCheck = await client.courses.students.get({
          courseId,
          userId: emailNormalized,
        });

        if (studentCheck.data && studentCheck.data.userId) {
          logger.info('Student already active member of Google Classroom', {
            leadId,
            email: emailNormalized,
          });
          return {
            success: true,
            status: 'ENROLLED',
            googleUserId: studentCheck.data.userId,
          };
        }
      } catch (checkErr: any) {
        // 404 means user is not yet enrolled, which is the expected normal case
        const code = checkErr?.status || checkErr?.code;
        if (code !== 404) {
          logger.warn('Student pre-check encountered non-404 status', {
            leadId,
            status: String(code),
          });
        }
      }

      // 2. Check if a pending invitation already exists
      try {
        const listInvites = await client.invitations.list({
          courseId,
          userId: emailNormalized,
        });

        if (listInvites.data.invitations && listInvites.data.invitations.length > 0) {
          const existingInvite = listInvites.data.invitations[0];
          logger.info('Pending invitation already active for student', {
            leadId,
            email: emailNormalized,
            invitationId: existingInvite.id || undefined,
          });
          return {
            success: true,
            status: 'ENROLLED',
            googleUserId: existingInvite.userId || undefined,
            invitationId: existingInvite.id || undefined,
          };
        }
      } catch (inviteListErr: any) {
        // Continue if listing invites fails with non-fatal status
        logger.warn('Error listing existing invitations', {
          error: inviteListErr?.message,
        });
      }

      // 3. Create student invitation (Google handles delivery to the student)
      const invitation = await client.invitations.create({
        requestBody: {
          userId: emailNormalized,
          courseId,
          role: 'STUDENT',
        },
      });

      logger.info('Successfully created Google Classroom student invitation', {
        leadId,
        email: emailNormalized,
        invitationId: invitation.data.id || undefined,
      });

      return {
        success: true,
        status: 'ENROLLED',
        googleUserId: invitation.data.userId || undefined,
        invitationId: invitation.data.id || undefined,
      };
    } catch (err: any) {
      const isTransient = this.isTransientError(err);
      const errorCode = String(
        err?.status || err?.code || err?.response?.status || 'UNKNOWN'
      );
      const errorMessage =
        err?.response?.data?.error?.message || err?.message || 'Google API error';

      logger.error('Google Classroom enrollment failed', err, {
        leadId,
        email: emailNormalized,
        errorCode,
        isTransient: String(isTransient),
      });

      return {
        success: false,
        status: 'FAILED',
        errorCode,
        errorMessage,
        isTransient,
      };
    }
  }

  /**
   * Remove student from Google Classroom course upon refund
   */
  async removeStudent(
    leadId: string,
    emailNormalized: string,
    googleUserId?: string | null,
    invitationId?: string | null,
    courseId: string = env.GOOGLE_CLASSROOM_COURSE_ID
  ): Promise<RemovalResult> {
    const client = this.getClient();
    const targetUserId = googleUserId || emailNormalized;

    try {
      logger.info('Initiating student removal from Google Classroom', {
        leadId,
        email: emailNormalized,
      });

      // 1. Delete student enrollment if active
      let studentDeleted = false;
      try {
        await client.courses.students.delete({
          courseId,
          userId: targetUserId,
        });
        studentDeleted = true;
        logger.info('Student active membership deleted from course', { leadId });
      } catch (delErr: any) {
        const code = delErr?.status || delErr?.code;
        if (code !== 404) {
          throw delErr; // Re-throw non-404 errors for transient handling
        }
      }

      // 2. If invitation was pending, delete the invitation
      if (invitationId) {
        try {
          await client.invitations.delete({
            id: invitationId,
          });
          logger.info('Pending invitation deleted from course', { leadId, invitationId });
        } catch (invDelErr: any) {
          const code = invDelErr?.status || invDelErr?.code;
          if (code !== 404) {
            throw invDelErr;
          }
        }
      }

      return {
        success: true,
        status: 'REMOVED',
      };
    } catch (err: any) {
      const isTransient = this.isTransientError(err);
      const errorCode = String(
        err?.status || err?.code || err?.response?.status || 'UNKNOWN'
      );
      const errorMessage =
        err?.response?.data?.error?.message || err?.message || 'Removal error';

      logger.error('Google Classroom removal failed', err, {
        leadId,
        email: emailNormalized,
        errorCode,
        isTransient: String(isTransient),
      });

      return {
        success: false,
        status: 'REMOVAL_PENDING',
        errorCode,
        errorMessage,
        isTransient,
      };
    }
  }
}

export const googleClassroomService = new GoogleClassroomService();
