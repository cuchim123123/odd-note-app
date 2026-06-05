import { Injectable, Inject } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { LoginInput } from '@odd-note-app/validation';
import type { LoginResult } from '../../shared/auth.types';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';

@Injectable()
export class LoginHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email!);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(input.password!, user.passwordHash);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const accessToken = this.tokenProvider.signAccessToken({ sub: user.id, displayName: user.displayName });
    const refresh = this.tokenProvider.generateRefreshToken(user.id);

    await this.tokenRepo.createRefreshToken({
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      userId: user.id,
    });

    return {
      user,
      tokens: { accessToken, refreshToken: refresh.rawToken },
    };
  }
}
