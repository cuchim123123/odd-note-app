import { Injectable, ConflictException, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../../../config';
import type { RegisterInput } from '@odd-note-app/validation';
import type { RegisterResult } from '../auth.types';
import { SessionTokenService } from '../services/session-token.service';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import { EmailVerificationService } from '../services/email-verification.service';
import { UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import type { IUnitOfWork } from '../../domain/ports/unit-of-work.port';

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);
  private readonly passwordSaltRounds: number;

  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly authConfig: AuthConfigService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
    private readonly emailVerificationService: EmailVerificationService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const existingUser = await this.unitOfWork.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    const { user, verificationToken } = await this.unitOfWork.runTransaction(async () => {
      let newUser;
      try {
        newUser = await this.unitOfWork.userRepository.create({
          email: input.email,
          displayName: input.displayName,
          passwordHash,
        });
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === 'P2002') {
          throw new ConflictException('Email is already registered');
        }
        throw err;
      }

      const token = await this.emailVerificationService.createTokenForUser(newUser.id);

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
