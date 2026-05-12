import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtConfigService, AuthConfigService } from '../config';
import type { AuthTokens } from './auth.types';

type RefreshTokenCreateClient = {
  refreshToken: {
    create(args: {
      data: {
        tokenHash: string;
        expiresAt: Date;
        userId: string;
      };
    }): Promise<unknown>;
    findUnique(args: {
      where: {
        tokenHash: string;
      };
    }): Promise<
      | {
          id: string;
          userId: string;
          expiresAt: Date;
          revokedAt: Date | null;
        }
      | null
    >;
    update(args: {
      where: {
        id: string;
      };
      data: {
        revokedAt: Date;
      };
    }): Promise<unknown>;
  };
};

type VerificationTokenCreateClient = {
  verificationToken: {
    create(args: {
      data: {
        tokenHash: string;
        expiresAt: Date;
        userId: string;
      };
    }): Promise<unknown>;
  };
};

/**
 * TokenService owns all token generation and persistence logic.
 * Separated from AuthService to keep auth logic focused on credentials/user state only.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generate JWT access + refresh token pair and store refresh token in database.
   * Refresh tokens are persisted for logout/invalidation and token rotation security.
   * Optionally accepts a Prisma transaction client for atomicity.
   */
  async generateAndStoreTokens(
    userId: string,
    prismaClient?: RefreshTokenCreateClient,
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

    // Hash refresh token before storing for security (breach resistance)
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

  /**
   * Create and store a verification token for email activation.
   * Token is hashed before storage and has an expiry.
   * Returns the raw token (to be sent via email); only hash is stored.
   * Optionally accepts a Prisma transaction client for atomicity.
   */
  async createAndStoreVerificationToken(
    userId: string,
    prismaClient?: VerificationTokenCreateClient,
  ): Promise<string> {
    const client = prismaClient ?? this.prisma;

    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    await client.verificationToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
      },
    });

    return verificationToken;
  }

  /**
   * Validate and use a verification token.
   * Returns the user ID if valid, throws if invalid/expired/already used.
   */
  async validateAndUseVerificationToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!verificationToken) {
      throw new Error('Verification token not found');
    }

    if (verificationToken.usedAt) {
      throw new Error('Verification token already used');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new Error('Verification token expired');
    }

    // Mark token as used (transactional caller should wrap this)
    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return verificationToken.userId;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new Error('Refresh token is invalid or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    return this.generateAndStoreTokens(tokenRecord.userId);
  }
}
