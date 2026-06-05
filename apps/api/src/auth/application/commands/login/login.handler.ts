import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
import { InvalidCredentialsError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { LoginResult } from '../../shared/auth.types';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { LoginCommand } from './login.command';
import { RefreshToken } from '../../../domain/entities/token.entity';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(command.input.email!);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    await user.authenticate(command.input.password!, this.passwordHasher);

    const accessToken = this.tokenProvider.signAccessToken({ sub: user.id, displayName: user.displayName });
    const refresh = this.tokenProvider.generateRefreshToken(user.id);

    const refreshTokenEntity = new RefreshToken(
      crypto.randomUUID(),
      refresh.tokenHash,
      user.id,
      refresh.expiresAt,
      null,
      new Date()
    );

    await this.tokenRepo.saveRefreshToken(refreshTokenEntity);

    return {
      user,
      tokens: { accessToken, refreshToken: refresh.rawToken },
    };
  }
}
