import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { InvalidCredentialsError } from '@modules/auth/domain/errors/auth-error';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '@modules/auth/application/ports/password-hasher.port';
import type { LoginResult } from '@modules/auth/application/shared/auth.types';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';
import { TOKEN_REPOSITORY } from '@modules/auth/application/ports/token.repository.port';
import type { TokenRepository } from '@modules/auth/application/ports/token.repository.port';
import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import { LoginCommand } from '@modules/auth/application/commands/login/login.command';
import { RefreshToken } from '@modules/auth/domain/entities/token.entity';

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

    const refreshTokenEntity = RefreshToken.create(refresh.tokenHash, user.id, refresh.expiresAt);

    await this.tokenRepo.saveRefreshToken(refreshTokenEntity);

    return {
      user,
      tokens: { accessToken, refreshToken: refresh.rawToken },
    };
  }
}
