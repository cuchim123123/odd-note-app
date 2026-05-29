import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { TOKEN_REPOSITORY } from './domain/ports/token.repository.port';
import type { ITokenRepository } from './domain/ports/token.repository.port';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import type { IUserRepository } from './domain/ports/user.repository.port';

@Injectable()
export class PasswordResetTokenService {
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: ITokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
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
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await this.tokenRepo.createResetToken({
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
      const result = await this.userRepo.runTransaction(async () => {
        // Find reset token via db client (or transaction client passed through repo)
        // Since Prisma client is used under the hood in PrismaTokenRepository,
        // we can find the token first
        const token = await this.tokenRepo.findResetToken(tokenHash);

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
        await this.tokenRepo.markResetTokenUsed(token.id);

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
