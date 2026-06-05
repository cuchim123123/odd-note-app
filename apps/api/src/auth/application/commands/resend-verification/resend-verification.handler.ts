import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { ResendVerificationCommand } from './resend-verification.command';
import { VerificationToken } from '../../../domain/entities/token.entity';
import { VerificationRequestedEvent } from '../../../domain/events/verification-requested.event';

@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<void> {
    const user = await this.userRepo.findByEmail(command.email);

    if (!user || user.isEmailVerified) {
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();

    const token = VerificationToken.create(tokenHash, user.id, expiresAt);

    await this.tokenRepo.saveVerificationToken(token);

    this.eventBus.publish(new VerificationRequestedEvent(user.email, user.displayName, rawToken));
  }
}
