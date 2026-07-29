import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import type { AuthTokens } from '@modules/auth/application/shared/auth.types';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';

import { UNIT_OF_WORK } from '@modules/auth/application/ports/unit-of-work.port';
import type { UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { InvalidTokenError } from '@modules/auth/domain/errors/auth-error';
import { RefreshTokensCommand } from '@modules/auth/application/commands/refresh-tokens/refresh-tokens.command';
import { RefreshToken } from '@modules/auth/domain/entities/token.entity';

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RefreshTokensCommand): Promise<AuthTokens> {
    const { userId } = this.tokenProvider.verifyRefreshToken(command.refreshToken);
    const tokenHash = this.tokenProvider.hashToken(command.refreshToken);

    return this.unitOfWork.execute(async (ctx) => {
      const tokenRecord = await ctx.repos.token.findRefreshToken(tokenHash);

      if (!tokenRecord || tokenRecord.userId !== userId) {
        throw new InvalidTokenError();
      }

      const consumedToken = tokenRecord.consume();
      await ctx.repos.token.saveRefreshToken(consumedToken);

      const user = await ctx.repos.user.findById(consumedToken.userId);
      if (!user) {
        throw new InvalidTokenError();
      }

      const accessToken = this.tokenProvider.signAccessToken({ sub: user.id, displayName: user.displayName });
      const newRefresh = this.tokenProvider.generateRefreshToken(user.id);

      const newRefreshTokenEntity = RefreshToken.create(newRefresh.tokenHash, user.id, newRefresh.expiresAt);

      await ctx.repos.token.saveRefreshToken(newRefreshTokenEntity);

      return { accessToken, refreshToken: newRefresh.rawToken };
    });
  }
}
