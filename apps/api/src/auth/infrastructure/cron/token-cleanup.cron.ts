import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TOKEN_REPOSITORY } from '../../application/ports/token.repository.port';
import type { TokenRepository } from '../../application/ports/token.repository.port';

@Injectable()
export class TokenCleanupCron implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenCleanupCron.name);
  private cleanupInterval: NodeJS.Timeout | null = null;
  // Run cleanup every hour
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  onModuleInit() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.CLEANUP_INTERVAL_MS);

    // Initial run with slight delay
    setTimeout(() => this.cleanupExpiredTokens(), 5000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private async cleanupExpiredTokens() {
    this.logger.debug('Running expired token cleanup...');
    const now = new Date();

    try {
      const res = await this.tokenRepo.deleteExpiredOrUsedTokens(now);
      const totalDeleted = res.refreshCount + res.verificationCount + res.resetCount;
      if (totalDeleted > 0) {
        this.logger.log(
          `Cleaned up ${totalDeleted} expired/revoked tokens (Refresh: ${res.refreshCount}, Verification: ${res.verificationCount}, Reset: ${res.resetCount})`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to clean up expired tokens', error instanceof Error ? error.stack : undefined);
    }
  }
}
