import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { InvalidTokenError, UserNotFoundError } from '../../../domain/errors/auth-error';
import type { User } from '../../../domain/entities/user.entity';
import { VerifyEmailCommand } from './verify-email.command';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<{ user: User }> {
    const tokenHash = this.tokenProvider.hashToken(command.token);

    const userId = await this.unitOfWork.execute(async (ctx) => {
      const verificationToken = await ctx.tokenRepository.findVerificationToken(tokenHash);

      if (!verificationToken) {
        throw new InvalidTokenError();
      }

      const consumedToken = verificationToken.consume();
      await ctx.tokenRepository.saveVerificationToken(consumedToken);

      return consumedToken.userId;
    });

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const updatedUser = user.verifyEmail();
    await this.userRepo.save(updatedUser);

    return { user: updatedUser };
  }
}
