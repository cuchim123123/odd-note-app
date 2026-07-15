import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/auth/infrastructure/persistence/prisma-client.type';
import type { TokenRepository } from '@modules/auth/application/ports/token.repository.port';
import { VerificationToken, PasswordResetToken, RefreshToken } from '@modules/auth/domain/entities/token.entity';

@Injectable()
export class PrismaTokenRepository implements TokenRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  // Verification tokens
  async saveVerificationToken(token: VerificationToken): Promise<void> {
    await this.prisma.verificationToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        tokenHash: token.tokenHash,
        userId: token.userId,
        expiresAt: token.expiresAt,
        usedAt: token.usedAt,
        createdAt: token.createdAt,
      },
      update: {
        usedAt: token.usedAt,
      },
    });
  }

  async findVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    const raw = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!raw) return null;
    return new VerificationToken(raw.id, raw.tokenHash, raw.userId, raw.expiresAt, raw.usedAt, raw.createdAt);
  }

  // Password reset tokens
  async saveResetToken(token: PasswordResetToken): Promise<void> {
    await this.prisma.passwordResetToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        tokenHash: token.tokenHash,
        userId: token.userId,
        expiresAt: token.expiresAt,
        usedAt: token.usedAt,
        createdAt: token.createdAt,
      },
      update: {
        usedAt: token.usedAt,
      },
    });
  }

  async findResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
    const raw = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!raw) return null;
    return new PasswordResetToken(raw.id, raw.tokenHash, raw.userId, raw.expiresAt, raw.usedAt, raw.createdAt);
  }

  // Refresh tokens
  async saveRefreshToken(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        tokenHash: token.tokenHash,
        userId: token.userId,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdAt: token.createdAt,
      },
      update: {
        revokedAt: token.revokedAt,
      },
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const raw = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!raw) return null;
    return new RefreshToken(raw.id, raw.tokenHash, raw.userId, raw.expiresAt, raw.revokedAt, raw.createdAt);
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
