import { Injectable } from '@nestjs/common';
import type { AuthTokens } from '../../auth.types';
import { SessionTokenService } from '../../session-token.service';

@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly sessionTokenService: SessionTokenService,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    return this.sessionTokenService.rotateRefreshToken(refreshToken);
  }
}
