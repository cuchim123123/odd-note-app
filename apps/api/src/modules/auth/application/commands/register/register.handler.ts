import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserAlreadyExistsError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { RegisterResult } from '../../shared/auth.types';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';

import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { RegisterCommand } from './register.command';
import { VerificationToken, RefreshToken } from '../../../domain/entities/token.entity';
import { User } from '../../../domain/entities/user.entity';

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
