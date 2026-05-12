import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenCleanupService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;
  // Run cleanup every hour
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

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
      const [refreshRes, verificationRes, resetRes] = await Promise.all([
        this.prisma.refreshToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { revokedAt: { lt: now } },
            ],
          },
        }),
        this.prisma.verificationToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { usedAt: { lt: now } },
            ],
          },
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { usedAt: { lt: now } },
            ],
          },
        }),
      ]);

      const totalDeleted = refreshRes.count + verificationRes.count + resetRes.count;
      if (totalDeleted > 0) {
        this.logger.log(
          `Cleaned up ${totalDeleted} expired/revoked tokens (Refresh: ${refreshRes.count}, Verification: ${verificationRes.count}, Reset: ${resetRes.count})`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to clean up expired tokens', error instanceof Error ? error.stack : undefined);
    }
  }
}
