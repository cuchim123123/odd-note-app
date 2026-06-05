import { Injectable, Inject } from '@nestjs/common';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { AuthUserMapper } from '../../../infrastructure/persistence/mappers/auth-user.mapper';
import { InvalidTokenError } from '../../../domain/errors/auth-error';
import type { AuthUserProfile } from '../../shared/auth.types';

@Injectable()
export class VerifyEmailHandler {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(token: string): Promise<{ user: AuthUserProfile }> {
    const tokenHash = this.tokenProvider.hashToken(token);

    const userId = await this.unitOfWork.execute(async (ctx) => {
      const verificationToken = await ctx.tokenRepository.findVerificationToken(tokenHash);

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
        throw new InvalidTokenError();
      }

      const now = new Date();
      const consumeResult = await ctx.tokenRepository.markVerificationTokenUsed(verificationToken.id, now);

      if (consumeResult.count !== 1) {
        throw new InvalidTokenError();
      }

      return verificationToken.userId;
    });

    const updatedUser = await this.userRepo.update(userId, { isEmailVerified: true });
    return { user: this.authUserMapper.toProfile(updatedUser) };
  }
}
