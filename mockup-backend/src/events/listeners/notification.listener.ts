import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../email/email.service';

export const STUDENT_REGISTERED = 'STUDENT_REGISTERED';
export const PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED';

export interface StudentRegisteredPayload {
  email: string;
  name: string;
}

export interface PasswordResetPayload {
  email: string;
  resetLink: string;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly emailService: EmailService) {}

  @OnEvent(STUDENT_REGISTERED)
  async handleStudentRegistered(payload: StudentRegisteredPayload) {
    this.logger.log(`Sending welcome email to ${payload.email}`);
    await this.emailService.sendMail(
      payload.email,
      'Welcome to ChainVerse!',
      `<p>Hi ${payload.name}, welcome to ChainVerse! Your account has been created.</p>`,
    );
  }

  @OnEvent(PASSWORD_RESET_REQUESTED)
  async handlePasswordReset(payload: PasswordResetPayload) {
    this.logger.log(`Sending password reset email to ${payload.email}`);
    await this.emailService.sendMail(
      payload.email,
      'Reset your ChainVerse password',
      `<p>Click <a href="${payload.resetLink}">here</a> to reset your password.</p>`,
    );
  }
}
