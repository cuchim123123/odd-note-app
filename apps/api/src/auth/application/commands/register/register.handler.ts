import { Injectable, Logger, Inject } from '@nestjs/common';
import { UserAlreadyExistsError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { RegisterInput } from '@odd-note-app/validation';
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

@Injectable()
export class RegisterHandler {
  private readonly logger = new Logger(RegisterHandler.name);
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const existingUser = await this.userRepo.findByEmail(input.email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const { user, verificationToken } = await this.unitOfWork.execute(async (ctx) => {
      let newUser;
      try {
        newUser = await ctx.userRepository.create({
          email: input.email,
          displayName: input.displayName,
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

      await ctx.tokenRepository.createVerificationToken({
        tokenHash,
        expiresAt,
        userId: newUser.id,
      });

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
