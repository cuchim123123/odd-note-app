import { Injectable, Logger, Inject } from '@nestjs/common';
import { MailerService } from '../../../common/mailer/mailer.service';
import { AuthUrlService } from '../../../common/auth-url.service';
import { PasswordResetTokenService } from '../services/password-reset-token.service';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly mailerService: MailerService,
    private readonly authUrlService: AuthUrlService,
  ) {}

  async execute(email: string): Promise<void> {
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
}
