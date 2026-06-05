import { Injectable } from '@nestjs/common';
import type { PrismaTransactionClient } from './prisma-client.type';
import type { TokenRepository } from '../../application/ports/token.repository.port';
import type { VerificationToken, PasswordResetToken, RefreshToken } from '../../domain/entities/token.entity';

@Injectable()
export class PrismaTokenRepository implements TokenRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  // Verification tokens
  async createVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<VerificationToken> {
    return this.prisma.verificationToken.create({ data });
  }

  async findVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    return this.prisma.verificationToken.findUnique({ where: { tokenHash } });
  }

  async markVerificationTokenUsed(id: string, now: Date): Promise<{ count: number }> {
    return this.prisma.verificationToken.updateMany({
      where: {
        id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
  }

  // Password reset tokens
  async createResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data });
  }

  async findResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markResetTokenUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  // Refresh tokens
  async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: revokedAt } },
      data: { revokedAt },
    });
  }

  async updateRefreshTokenRevocation(id: string, revokedAt: Date): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: revokedAt } },
      data: { revokedAt },
    });
  }

  // Cleanup
  async deleteExpiredOrUsedTokens(now: Date) {
    const [refreshRes, verificationRes, resetRes] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: now } }] },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: now } }] },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: now } }] },
      }),
    ]);

    return {
      refreshCount: refreshRes.count,
      verificationCount: verificationRes.count,
      resetCount: resetRes.count,
    };
  }
}
