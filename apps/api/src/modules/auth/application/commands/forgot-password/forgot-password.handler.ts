import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { ForgotPasswordCommand } from './forgot-password.command';
import { PasswordResetToken } from '../../../domain/entities/token.entity';

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<ForgotPasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<void> {
    const user = await this.userRepo.findByEmail(command.email);

    if (!user) {
      // Don't reveal whether email exists (security)
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();
    const token = PasswordResetToken.create(tokenHash, user.id, expiresAt);

    await this.unitOfWork.execute(async (ctx) => {
      await ctx.tokenRepository.saveResetToken(token);
      
      await ctx.outbox.scheduleInternalCommand('SendPasswordResetEmail', {
        email: user.email.value,
        resetToken: rawToken,
      });
    });
  }
}
