import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { JwtConfigService } from '../../../config';
import type { AuthTokens } from '../auth.types';
import { UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import type { IUnitOfWork } from '../../domain/ports/unit-of-work.port';

type RefreshTokenPayload = {
  sub?: string;
  type?: string;
};

@Injectable()
export class SessionTokenService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
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

  async generateAndStoreTokens(userId: string): Promise<AuthTokens> {
    const user = await this.unitOfWork.userRepository.findById(userId);

    const accessToken = this.jwtService.sign(
      { sub: userId, displayName: user?.displayName ?? 'User' },
      this.jwtConfig.getAccessTokenSignOptions(),
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      this.jwtConfig.getRefreshTokenSignOptions(),
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiryMs = this.jwtConfig.getRefreshTokenExpiryMs();
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.unitOfWork.tokenRepository.createRefreshToken({
      tokenHash,
      expiresAt,
      userId,
    });

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();

    await this.unitOfWork.tokenRepository.revokeRefreshToken(tokenHash, now);
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
    const { userId } = this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    return this.unitOfWork.runTransaction(async () => {
      const tokenRecord = await this.unitOfWork.tokenRepository.findRefreshToken(tokenHash);

      if (
        !tokenRecord ||
        tokenRecord.userId !== userId ||
        tokenRecord.revokedAt ||
        tokenRecord.expiresAt < new Date()
      ) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      const now = new Date();
      const revokeResult = await this.unitOfWork.tokenRepository.updateRefreshTokenRevocation(tokenRecord.id, now);

      if (revokeResult.count !== 1) {
        throw new UnauthorizedException('Refresh token is invalid or expired');
      }

      return this.generateAndStoreTokens(tokenRecord.userId);
    });
  }
}
