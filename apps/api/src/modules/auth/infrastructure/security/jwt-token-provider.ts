import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { JwtConfigService, AuthConfigService } from '../../../../config';
import { InvalidTokenError } from '../../domain/errors/auth-error';
import type {
  TokenProvider,
  AccessTokenData,
  GeneratedToken,
} from '../../application/ports/token-provider.port';

type RefreshTokenPayload = {
  sub?: string;
  type?: string;
};

@Injectable()
export class JwtTokenProvider implements TokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly authConfig: AuthConfigService,
  ) {}

  signAccessToken(data: AccessTokenData): string {
    return this.jwtService.sign(
      { sub: data.sub, displayName: data.displayName },
      this.jwtConfig.getAccessTokenSignOptions(),
    );
  }

  generateRefreshToken(userId: string): GeneratedToken {
    const rawToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      this.jwtConfig.getRefreshTokenSignOptions(),
    );
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.jwtConfig.getRefreshTokenExpiryMs());

    return { rawToken, tokenHash, expiresAt };
  }

  generateVerificationToken(): GeneratedToken {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    return { rawToken, tokenHash, expiresAt };
  }

  generatePasswordResetToken(): GeneratedToken {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    return { rawToken, tokenHash, expiresAt };
  }

  verifyRefreshToken(rawToken: string): { userId: string } {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(rawToken, {
        secret: this.jwtConfig.getRefreshTokenSecret(),
      });
    } catch {
      throw new InvalidTokenError('Refresh token is invalid or expired');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new InvalidTokenError('Refresh token is invalid or expired');
    }

    return { userId: payload.sub };
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
