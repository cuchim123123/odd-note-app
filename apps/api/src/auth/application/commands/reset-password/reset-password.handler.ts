import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { InvalidTokenError, UserNotFoundError } from '../../../domain/errors/auth-error';
import { ResetPasswordCommand } from './reset-password.command';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const tokenHash = this.tokenProvider.hashToken(command.token);

    const userId = await this.unitOfWork.execute(async (ctx) => {
      const resetToken = await ctx.tokenRepository.findResetToken(tokenHash);

      if (!resetToken) {
        throw new InvalidTokenError('Invalid password reset token');
      }

      const consumedToken = resetToken.consume();
      await ctx.tokenRepository.saveResetToken(consumedToken);

      return consumedToken.userId;
    });

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const hashedPassword = await this.passwordHasher.hash(command.passwordHash);
    const updatedUser = user.changePassword(hashedPassword);
    
    await this.userRepo.save(updatedUser);
  }
}
