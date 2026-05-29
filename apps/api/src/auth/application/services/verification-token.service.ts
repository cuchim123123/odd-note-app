import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthConfigService } from '../../../config';
import { TOKEN_REPOSITORY } from '../../domain/ports/token.repository.port';
import type { ITokenRepository } from '../../domain/ports/token.repository.port';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

@Injectable()
export class VerificationTokenService {
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: ITokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createAndStoreVerificationToken(
    userId: string,
    tx?: unknown,
  ): Promise<string> {
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    await this.tokenRepo.createVerificationToken({
      tokenHash,
      expiresAt,
      userId,
    }, tx);

    return verificationToken;
  }

  async validateAndUseVerificationToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    return this.userRepo.runTransaction(async (tx) => {
      const verificationToken = await this.tokenRepo.findVerificationToken(tokenHash, tx);

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      const now = new Date();
      const consumeResult = await this.tokenRepo.markVerificationTokenUsed(verificationToken.id, now, tx);

      if (consumeResult.count !== 1) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      return verificationToken.userId;
    });
  }
}
