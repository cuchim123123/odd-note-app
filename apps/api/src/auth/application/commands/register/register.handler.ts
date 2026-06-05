import { Logger, Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import * as crypto from 'crypto';
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
import { MAIL_SENDER } from '../../ports/mail-sender.port';
import type { MailSender } from '../../ports/mail-sender.port';
import { RegisterCommand } from './register.command';
import { VerificationToken, RefreshToken } from '../../../domain/entities/token.entity';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  private readonly logger = new Logger(RegisterHandler.name);
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    const existingUser = await this.userRepo.findByEmail(command.input.email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(command.input.password);

    const { user, verificationToken } = await this.unitOfWork.execute(async (ctx) => {
      let newUser;
      try {
        newUser = await ctx.userRepository.create({
          email: command.input.email,
          displayName: command.input.displayName,
          passwordHash,
        });
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === 'P2002') {
          throw new UserAlreadyExistsError();
        }
        throw err;
      }

      const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();

      const tokenEntity = new VerificationToken(
        crypto.randomUUID(),
        tokenHash,
        newUser.id,
        expiresAt,
        null,
        new Date()
      );

      await ctx.tokenRepository.saveVerificationToken(tokenEntity);

      return { user: newUser, verificationToken: rawToken };
    });

    try {
      await this.mailSender.sendVerificationEmail(user.email, user.displayName, verificationToken);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email for ${user.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

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
