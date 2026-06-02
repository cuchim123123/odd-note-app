import { Injectable, Logger, Inject } from '@nestjs/common';
import { MAIL_SENDER } from '../ports/mail-sender.port';
import type { MailSender } from '../ports/mail-sender.port';
import { TOKEN_PROVIDER } from '../ports/token-provider.port';
import type { TokenProvider } from '../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../ports/token.repository.port';
import type { TokenRepository } from '../ports/token.repository.port';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // Don't reveal whether email exists (security)
      return;
    }

    try {
      const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();

      await this.tokenRepo.createResetToken({
        tokenHash,
        expiresAt,
        userId: user.id,
      });
      await this.mailSender.sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      // Log but don't throw - non-critical
      this.logger.error('Failed to send password reset email:', error);
    }
  }
}
