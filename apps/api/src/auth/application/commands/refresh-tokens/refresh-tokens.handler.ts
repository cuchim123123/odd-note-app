import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import type { AuthTokens } from '../../shared/auth.types';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { InvalidTokenError } from '../../../domain/errors/auth-error';
import { RefreshTokensCommand } from './refresh-tokens.command';

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RefreshTokensCommand): Promise<AuthTokens> {
    const { userId } = this.tokenProvider.verifyRefreshToken(command.refreshToken);
    const tokenHash = this.tokenProvider.hashToken(command.refreshToken);

    return this.unitOfWork.execute(async (ctx) => {
      const tokenRecord = await ctx.tokenRepository.findRefreshToken(tokenHash);

      if (
        !tokenRecord ||
        tokenRecord.userId !== userId ||
        tokenRecord.revokedAt ||
        tokenRecord.expiresAt < new Date()
      ) {
        throw new InvalidTokenError();
      }

      const now = new Date();
      const revokeResult = await ctx.tokenRepository.updateRefreshTokenRevocation(tokenRecord.id, now);

      if (revokeResult.count !== 1) {
        throw new InvalidTokenError();
      }

      const user = await ctx.userRepository.findById(tokenRecord.userId);
      if (!user) {
        throw new InvalidTokenError();
      }

      const accessToken = this.tokenProvider.signAccessToken({ sub: user.id, displayName: user.displayName });
      const newRefresh = this.tokenProvider.generateRefreshToken(user.id);

      await ctx.tokenRepository.createRefreshToken({
        tokenHash: newRefresh.tokenHash,
        expiresAt: newRefresh.expiresAt,
        userId: user.id,
      });

      return { accessToken, refreshToken: newRefresh.rawToken };
    });
  }
}
