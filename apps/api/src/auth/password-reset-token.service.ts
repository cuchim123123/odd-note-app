import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config';

/**
 * Manages password reset token lifecycle.
 * - Creates hashed reset tokens with expiry
 * - Validates and marks tokens as used (atomic transaction for safety)
 * - Prevents token reuse
 */
@Injectable()
export class PasswordResetTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Create and store a password reset token for a user.
   * Token is hashed before storage and has an expiry.
   * Returns raw token (not hashed) to send to user.
   */
  async createTokenForUser(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
      },
    });

    return rawToken;
  }

  /**
   * Validate a password reset token and mark it as used atomically.
   * - Prevents reuse by checking usedAt
   * - Checks expiry
   * - Uses transaction to prevent race conditions
   * Throws BadRequestException if token is invalid, expired, or already used.
   */
  async validateAndMarkAsUsed(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(rawToken);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const token = await tx.passwordResetToken.findUnique({
          where: { tokenHash },
        });

        if (!token) {
          throw new BadRequestException('Invalid password reset token');
        }

        if (token.usedAt) {
          throw new BadRequestException('This password reset link has already been used');
        }

        if (new Date() > token.expiresAt) {
          throw new BadRequestException('This password reset link has expired');
        }

        // Mark as used atomically
        await tx.passwordResetToken.update({
          where: { tokenHash },
          data: { usedAt: new Date() },
        });

        return { userId: token.userId };
      });

      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid password reset token');
    }
  }

  /**
   * Cleanup expired password reset tokens (for background job/cron).
   */
  async cleanupExpiredTokens(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return { deletedCount: result.count };
  }
}
