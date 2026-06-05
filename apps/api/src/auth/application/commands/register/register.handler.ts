import { Inject } from '@nestjs/common';
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserAlreadyExistsError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { RegisterResult } from '../../shared/auth.types';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UNIT_OF_WORK } from '../../ports/unit-of-work.port';
import type { UnitOfWork } from '../../ports/unit-of-work.port';
import { RegisterCommand } from './register.command';
import { VerificationToken, RefreshToken } from '../../../domain/entities/token.entity';
import { User } from '../../../domain/entities/user.entity';
import { UserRegisteredEvent } from '../../../domain/events/user-registered.event';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    const existingUser = await this.userRepo.findByEmail(command.input.email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(command.input.password);

    const { user, verificationToken } = await this.unitOfWork.execute(async (ctx) => {
      const newUser = User.create(command.input.email, command.input.displayName, passwordHash);
      await ctx.userRepository.save(newUser);

      const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();

      const tokenEntity = VerificationToken.create(tokenHash, newUser.id, expiresAt);

      await ctx.tokenRepository.saveVerificationToken(tokenEntity);

      return { user: newUser, verificationToken: rawToken };
    });

    this.eventBus.publish(new UserRegisteredEvent(user.email, user.displayName, verificationToken));

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
