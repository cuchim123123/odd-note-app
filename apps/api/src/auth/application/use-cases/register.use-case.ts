import { Injectable, Logger, Inject } from '@nestjs/common';
import { UserAlreadyExistsError } from '../../domain/errors/auth-error';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../../../config';
import type { RegisterInput } from '@odd-note-app/validation';
import type { RegisterResult } from '../auth.types';
import { SessionTokenService } from '../services/session-token.service';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import { EmailVerificationService } from '../services/email-verification.service';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';
import { UNIT_OF_WORK } from '../ports/unit-of-work.port';
import type { UnitOfWork } from '../ports/unit-of-work.port';

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);
  private readonly passwordSaltRounds: number;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly authConfig: AuthConfigService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
    private readonly emailVerificationService: EmailVerificationService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const existingUser = await this.userRepo.findByEmail(input.email);

    if (existingUser) {
      throw new UserAlreadyExistsError();
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

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

      const token = await this.emailVerificationService.createTokenForUser(newUser.id, ctx.tokenRepository);

      return { user: newUser, verificationToken: token };
    });

    try {
      await this.emailVerificationService.sendVerificationForUser(user, verificationToken);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email for ${user.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    const tokens = await this.sessionTokenService.generateAndStoreTokens(user.id);

    return {
      user: this.authUserMapper.toProfile(user),
      tokens,
    };
  }
}
