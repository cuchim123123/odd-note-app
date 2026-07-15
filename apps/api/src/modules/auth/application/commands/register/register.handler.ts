import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserAlreadyExistsError } from '@modules/auth/domain/errors/auth-error';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '@modules/auth/application/ports/password-hasher.port';
import type { RegisterResult } from '@modules/auth/application/shared/auth.types';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';

import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import { UNIT_OF_WORK } from '@modules/auth/application/ports/unit-of-work.port';
import type { UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { RegisterCommand } from '@modules/auth/application/commands/register/register.command';
import { VerificationToken, RefreshToken } from '@modules/auth/domain/entities/token.entity';
import { User } from '@modules/auth/domain/entities/user.entity';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    const existingUser = await this.userRepo.findByEmail(command.input.email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(command.input.password);

    const { user, tokens } = await this.unitOfWork.execute(async (ctx) => {
      const newUser = User.create(command.input.email, command.input.displayName, passwordHash);
      await ctx.userRepository.save(newUser);

      const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();
      const tokenEntity = VerificationToken.create(tokenHash, newUser.id, expiresAt);
      await ctx.tokenRepository.saveVerificationToken(tokenEntity);

      const accessToken = this.tokenProvider.signAccessToken({ sub: newUser.id, displayName: newUser.displayName });
      const refresh = this.tokenProvider.generateRefreshToken(newUser.id);
      const refreshTokenEntity = RefreshToken.create(refresh.tokenHash, newUser.id, refresh.expiresAt);
      await ctx.tokenRepository.saveRefreshToken(refreshTokenEntity);

      // Schedule email sending as an internal command
      await ctx.outbox.scheduleInternalCommand('SendVerificationEmail', {
        email: newUser.email.value,
        displayName: newUser.displayName,
        verificationToken: rawToken,
      });

      return { 
        user: newUser, 
        tokens: { accessToken, refreshToken: refresh.rawToken },
      };
    });

    return {
      user,
      tokens,
    };
  }
}
