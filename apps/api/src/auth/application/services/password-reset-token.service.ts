import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import type { IUnitOfWork } from '../../domain/ports/unit-of-work.port';

@Injectable()
export class PasswordResetTokenService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Create and store a password reset token for a user.
   * Token is hashed before storage and has an expiry.
   * Returns raw token (not hashed) to send to user.
   */
  async createTokenForTest(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await this.unitOfWork.tokenRepository.createResetToken({
      tokenHash,
      expiresAt,
      userId,
    });

    return rawToken;
  }

  async createTokenForUser(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await this.unitOfWork.tokenRepository.createResetToken({
      tokenHash,
      expiresAt,
      userId,
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
      const result = await this.unitOfWork.runTransaction(async () => {
        // Find reset token via db client (or transaction client passed through repo)
        // Since Prisma client is used under the hood in PrismaTokenRepository,
        // we can find the token first
        const token = await this.unitOfWork.tokenRepository.findResetToken(tokenHash);

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
        await this.unitOfWork.tokenRepository.markResetTokenUsed(token.id);

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
}
