import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { ForgotPasswordCommand } from './forgot-password.command';
import { PasswordResetToken } from '../../../domain/entities/token.entity';

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<void> {
    const user = await this.userRepo.findByEmail(command.email);

    if (!user) {
      // Don't reveal whether email exists (security)
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();
    const token = PasswordResetToken.create(tokenHash, user.id, expiresAt);
    await this.tokenRepo.saveResetToken(token);

    this.eventBus.publish(new PasswordResetRequestedEvent(user.email, rawToken));
  }
}
