import { Logger, Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { MAIL_SENDER } from '../../ports/mail-sender.port';
import type { MailSender } from '../../ports/mail-sender.port';
import { ResendVerificationCommand } from './resend-verification.command';
import { VerificationToken } from '../../../domain/entities/token.entity';

@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  private readonly logger = new Logger(ResendVerificationHandler.name);

  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<void> {
    const user = await this.userRepo.findByEmail(command.email);

    if (!user || user.isEmailVerified) {
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();

    const token = new VerificationToken(
      crypto.randomUUID(),
      tokenHash,
      user.id,
      expiresAt,
      null,
      new Date()
    );

    await this.tokenRepo.saveVerificationToken(token);

    try {
      await this.mailSender.sendVerificationEmail(user.email, user.displayName, rawToken);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email for ${user.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
