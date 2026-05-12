import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { PasswordResetTokenService } from './password-reset-token.service';

/**
 * Orchestrates password reset use-cases.
 * - Create password reset token and send email
 * - Validate token and reset password
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly mailerService: MailerService,
    private readonly authUrlService: AuthUrlService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  /**
   * Send password reset email.
   * User provides email, we find the user, generate a reset token, and send it via email.
   * Non-critical operation: if email send fails, we still report success (security UX).
   */
  async sendResetPasswordEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal whether email exists (security)
      return;
    }

    try {
      const rawToken = await this.passwordResetTokenService.createTokenForUser(user.id);
      const resetUrl = this.authUrlService.buildResetPasswordUrl(rawToken);
      await this.mailerService.sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      // Log but don't throw - non-critical
      this.logger.error('Failed to send password reset email:', error);
    }
  }

  /**
   * Reset password with token.
   * Validates the token, hashes new password, and updates user.
   * Throws BadRequestException if token is invalid/expired/reused.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.passwordResetTokenService.validateAndMarkAsUsed(token);

    const hashedPassword = await bcrypt.hash(newPassword, this.passwordSaltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }
}
