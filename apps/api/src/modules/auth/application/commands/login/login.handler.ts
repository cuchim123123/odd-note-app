import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { InvalidCredentialsError } from '@modules/auth/domain/errors/auth-error';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '@modules/auth/application/ports/password-hasher.port';
import type { LoginResult } from '@modules/auth/application/shared/auth.types';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';
import { UNIT_OF_WORK, type UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { LoginCommand } from '@modules/auth/application/commands/login/login.command';
import { RefreshToken } from '@modules/auth/domain/entities/token.entity';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    return this.unitOfWork.execute(async ({ repos }) => {
      const user = await repos.user.findByEmail(command.input.email!);

      if (!user) {
        throw new InvalidCredentialsError();
      }

      await user.authenticate(command.input.password!, this.passwordHasher);

      const accessToken = this.tokenProvider.signAccessToken({ sub: user.id, displayName: user.displayName });
      const refresh = this.tokenProvider.generateRefreshToken(user.id);

      const refreshTokenEntity = RefreshToken.create(refresh.tokenHash, user.id, refresh.expiresAt);

      await repos.token.saveRefreshToken(refreshTokenEntity);

      return {
        user,
        tokens: { accessToken, refreshToken: refresh.rawToken },
      };
    });
  }
}
