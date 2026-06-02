import { Injectable, Inject } from '@nestjs/common';
import { InvalidTokenError, TokenAlreadyUsedError, TokenExpiredError } from '../../domain/errors/auth-error';
import { randomBytes, createHash } from 'crypto';
import { TOKEN_REPOSITORY } from '../ports/token.repository.port';
import type { TokenRepository } from '../ports/token.repository.port';
import { UNIT_OF_WORK } from '../ports/unit-of-work.port';
import type { UnitOfWork } from '../ports/unit-of-work.port';
import { AuthError } from '../../domain/errors/auth-error';

@Injectable()
export class PasswordResetTokenService {
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

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

  async validateAndMarkAsUsed(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(rawToken);

    try {
      const result = await this.unitOfWork.execute(async (ctx) => {
        const token = await ctx.tokenRepository.findResetToken(tokenHash);

        if (!token) {
          throw new InvalidTokenError('Invalid password reset token');
        }

        if (token.usedAt) {
          throw new TokenAlreadyUsedError('This password reset link has already been used');
        }

        if (new Date() > token.expiresAt) {
          throw new TokenExpiredError('This password reset link has expired');
        }

        await ctx.tokenRepository.markResetTokenUsed(token.id);

        return { userId: token.userId };
      });

      return result;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new InvalidTokenError('Invalid password reset token');
    }
  }
}
