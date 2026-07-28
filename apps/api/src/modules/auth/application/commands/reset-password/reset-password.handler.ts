import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '@modules/auth/application/ports/password-hasher.port';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';

import { UNIT_OF_WORK } from '@modules/auth/application/ports/unit-of-work.port';
import type { UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { InvalidTokenError, UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import { ResetPasswordCommand } from '@modules/auth/application/commands/reset-password/reset-password.command';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const tokenHash = this.tokenProvider.hashToken(command.token);

    await this.unitOfWork.execute(async (ctx) => {
      const resetToken = await ctx.repos.token.findResetToken(tokenHash);

      if (!resetToken) {
        throw new InvalidTokenError('Invalid password reset token');
      }

      const consumedToken = resetToken.consume();
      await ctx.repos.token.saveResetToken(consumedToken);

      const user = await ctx.repos.user.findById(consumedToken.userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      const hashedPassword = await this.passwordHasher.hash(command.passwordHash);
      const updatedUser = user.changePassword(hashedPassword);
      
      await ctx.repos.user.save(updatedUser);
    });
  }
}
