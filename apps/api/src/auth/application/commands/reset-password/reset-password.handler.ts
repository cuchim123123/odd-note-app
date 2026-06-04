import { Injectable, Inject } from '@nestjs/common';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { InvalidTokenError, TokenAlreadyUsedError, TokenExpiredError } from '../../../domain/errors/auth-error';

@Injectable()
export class ResetPasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.tokenProvider.hashToken(token);

    const userId = await this.unitOfWork.execute(async (ctx) => {
      const resetToken = await ctx.tokenRepository.findResetToken(tokenHash);

      if (!resetToken) {
        throw new InvalidTokenError('Invalid password reset token');
      }

      if (resetToken.usedAt) {
        throw new TokenAlreadyUsedError('This password reset link has already been used');
      }

      if (new Date() > resetToken.expiresAt) {
        throw new TokenExpiredError('This password reset link has expired');
      }

      await ctx.tokenRepository.markResetTokenUsed(resetToken.id);

      return resetToken.userId;
    });

    const hashedPassword = await this.passwordHasher.hash(newPassword);
    await this.userRepo.update(userId, { passwordHash: hashedPassword });
  }
}
