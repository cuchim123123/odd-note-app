import { Injectable, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import type { IUserRepository } from './domain/ports/user.repository.port';

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
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
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
    const user = await this.userRepo.findByEmail(email);

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

    await this.userRepo.update(userId, { passwordHash: hashedPassword });
  }
}
