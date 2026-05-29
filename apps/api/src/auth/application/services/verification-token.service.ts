import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthConfigService } from '../../../config';
import { UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import type { IUnitOfWork } from '../../domain/ports/unit-of-work.port';

@Injectable()
export class VerificationTokenService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createAndStoreVerificationToken(userId: string): Promise<string> {
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    await this.unitOfWork.tokenRepository.createVerificationToken({
      tokenHash,
      expiresAt,
      userId,
    });

    return verificationToken;
  }

  async validateAndUseVerificationToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    return this.unitOfWork.runTransaction(async () => {
      const verificationToken = await this.unitOfWork.tokenRepository.findVerificationToken(tokenHash);

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      const now = new Date();
      const consumeResult = await this.unitOfWork.tokenRepository.markVerificationTokenUsed(verificationToken.id, now);

      if (consumeResult.count !== 1) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      return verificationToken.userId;
    });
  }
}
