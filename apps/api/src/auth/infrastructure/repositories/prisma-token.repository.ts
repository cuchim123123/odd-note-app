import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ITokenRepository } from '../../domain/ports/token.repository.port';
import type { VerificationToken, PasswordResetToken, RefreshToken } from '@prisma/client';

@Injectable()
export class PrismaTokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Verification tokens
  async createVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: unknown): Promise<VerificationToken> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.verificationToken.create({ data });
  }

  async findVerificationToken(tokenHash: string, tx?: unknown): Promise<VerificationToken | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.verificationToken.findUnique({ where: { tokenHash } });
  }

  async markVerificationTokenUsed(id: string, now: Date, tx?: unknown): Promise<{ count: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.verificationToken.updateMany({
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
  async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: unknown): Promise<RefreshToken> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string, tx?: unknown): Promise<RefreshToken | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: revokedAt } },
      data: { revokedAt },
    });
  }

  async updateRefreshTokenRevocation(id: string, revokedAt: Date, tx?: unknown): Promise<{ count: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any) ?? this.prisma;
    return client.refreshToken.updateMany({
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
