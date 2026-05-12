import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtConfigService } from '../config';
import type { AuthTokens } from './auth.types';

type RefreshTokenPayload = {
  sub?: string;
  type?: string;
};

@Injectable()
export class SessionTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private verifyRefreshToken(refreshToken: string): { userId: string } {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.jwtConfig.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    return { userId: payload.sub };
  }

  async generateAndStoreTokens(
    userId: string,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<AuthTokens> {
    const client = prismaClient ?? this.prisma;

    const accessToken = this.jwtService.sign(
      { sub: userId },
      this.jwtConfig.getAccessTokenSignOptions(),
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      this.jwtConfig.getRefreshTokenSignOptions(),
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiryMs = this.jwtConfig.getRefreshTokenExpiryMs();
    const expiresAt = new Date(Date.now() + expiryMs);

    await client.refreshToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
      },
    });

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const { userId } = this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
    const { userId } = this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    return this.prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (
        !tokenRecord ||
        tokenRecord.userId !== userId ||
        tokenRecord.revokedAt ||
        tokenRecord.expiresAt < new Date()
      ) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      const now = new Date();
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          id: tokenRecord.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revokeResult.count !== 1) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      return this.generateAndStoreTokens(tokenRecord.userId, tx);
    });
  }
}
