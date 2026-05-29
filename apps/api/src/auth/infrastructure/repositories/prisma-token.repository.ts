import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ITokenRepository } from '../../domain/ports/token.repository.port';
import type { VerificationToken, PasswordResetToken, RefreshToken } from '../../domain/entities/token.entity';
import { txStorage } from './tx-storage';

@Injectable()
export class PrismaTokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return txStorage.getStore() ?? this.prisma;
  }

  // Verification tokens
  async createVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<VerificationToken> {
    return this.getClient().verificationToken.create({ data });
  }

  async findVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    return this.getClient().verificationToken.findUnique({ where: { tokenHash } });
  }

  async markVerificationTokenUsed(id: string, now: Date): Promise<{ count: number }> {
    return this.getClient().verificationToken.updateMany({
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
    return this.getClient().passwordResetToken.create({ data });
  }

  async findResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.getClient().passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async markResetTokenUsed(id: string): Promise<void> {
    await this.getClient().passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  // Refresh tokens
  async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.getClient().refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.getClient().refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.getClient().refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: revokedAt } },
      data: { revokedAt },
    });
  }

  async updateRefreshTokenRevocation(id: string, revokedAt: Date): Promise<{ count: number }> {
    return this.getClient().refreshToken.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: revokedAt } },
      data: { revokedAt },
    });
  }

  // Cleanup
  async deleteExpiredOrUsedTokens(now: Date) {
    const [refreshRes, verificationRes, resetRes] = await Promise.all([
      this.getClient().refreshToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: now } }] },
      }),
      this.getClient().verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: now } }] },
      }),
      this.getClient().passwordResetToken.deleteMany({
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
