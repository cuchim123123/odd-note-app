import { Injectable, Inject } from '@nestjs/common';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';

@Injectable()
export class LogoutHandler {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    this.tokenProvider.verifyRefreshToken(refreshToken);
    const tokenHash = this.tokenProvider.hashToken(refreshToken);
    const now = new Date();

    await this.tokenRepo.revokeRefreshToken(tokenHash, now);
  }
}
