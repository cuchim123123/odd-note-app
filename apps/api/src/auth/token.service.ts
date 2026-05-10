import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtConfigService, AuthConfigService } from '../config';
import type { AuthTokens } from './auth.types';

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

  /**
   * Generate JWT access + refresh token pair and store refresh token in database.
   * Refresh tokens are persisted for logout/invalidation and token rotation security.
   * Optionally accepts a Prisma transaction client for atomicity.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateAndStoreTokens(userId: string, prismaClient?: any): Promise<AuthTokens> {
    const client = prismaClient || this.prisma;

    const accessToken = this.jwtService.sign(
      { sub: userId },
      this.jwtConfig.getAccessTokenSignOptions(),
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      this.jwtConfig.getRefreshTokenSignOptions(),
    );

    // Hash refresh token before storing for security (breach resistance)
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createAndStoreVerificationToken(userId: string, prismaClient?: any): Promise<string> {
    const client = prismaClient || this.prisma;

    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');
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
    const tokenHash = createHash('sha256').update(token).digest('hex');
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
}
