import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthConfigService } from '../../../config';
import { TOKEN_REPOSITORY } from '../ports/token.repository.port';
import type { ITokenRepository } from '../ports/token.repository.port';
import { UNIT_OF_WORK } from '../ports/unit-of-work.port';
import type { IUnitOfWork } from '../ports/unit-of-work.port';

@Injectable()
export class VerificationTokenService {
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: ITokenRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createAndStoreVerificationToken(userId: string, tokenRepo?: ITokenRepository): Promise<string> {
    const repo = tokenRepo ?? this.tokenRepo;
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    await repo.createVerificationToken({
      tokenHash,
      expiresAt,
      userId,
    });

    return verificationToken;
  }

  async validateAndUseVerificationToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    return this.unitOfWork.execute(async (ctx) => {
      const verificationToken = await ctx.tokenRepository.findVerificationToken(tokenHash);

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      const now = new Date();
      const consumeResult = await ctx.tokenRepository.markVerificationTokenUsed(verificationToken.id, now);

      if (consumeResult.count !== 1) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      return verificationToken.userId;
    });
  }
}
