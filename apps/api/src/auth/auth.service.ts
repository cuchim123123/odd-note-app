import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../config';
import type { LoginInput, RegisterInput, ChangePasswordOutput } from '@odd-note-app/validation';
import type { AuthTokens, AuthUserProfile, LoginResult, RegisterResult } from './auth.types';
import { SessionTokenService } from './session-token.service';
import { AuthUserMapper } from './auth-user.mapper';
import { EmailVerificationService } from './email-verification.service';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import type { IUserRepository } from './domain/ports/user.repository.port';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordSaltRounds: number;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly authConfig: AuthConfigService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
    private readonly emailVerificationService: EmailVerificationService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    // Pre-check for nicer fast-fail; also catch duplicate email race conditions on create
    const existingUser = await this.userRepo.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    // Transactional flow: user → verification token
    // All must succeed together, or the transaction rolls back.
    const { user, verificationToken } = await this.userRepo.runTransaction(async (tx) => {
      let newUser;
      try {
        newUser = await this.userRepo.create({
          email: input.email,
          displayName: input.displayName,
          passwordHash,
        }, tx);
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === 'P2002') {
          throw new ConflictException('Email is already registered');
        }
        throw err;
      }

      const token = await this.emailVerificationService.createTokenForUser(newUser.id, tx);

      return { user: newUser, verificationToken: token };
    });

    // Verification email delivery is a non-critical async side effect.
    // The account must be created even if SMTP is temporarily unavailable,
    // otherwise users see a failed registration while the user record already exists.
    try {
      await this.emailVerificationService.sendVerificationForUser(user, verificationToken);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email for ${user.email}`,
        error instanceof Error ? error.stack : undefined,
        AuthService.name,
      );
    }

    const tokens = await this.sessionTokenService.generateAndStoreTokens(user.id);

    return {
      user: this.authUserMapper.toProfile(user),
      tokens,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email!);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password!, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.sessionTokenService.generateAndStoreTokens(user.id);

    return {
      user: this.authUserMapper.toProfile(user),
      tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessionTokenService.revokeRefreshToken(refreshToken);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.sessionTokenService.rotateRefreshToken(refreshToken);
  }

  async getCurrentUser(userId: string): Promise<AuthUserProfile> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.authUserMapper.toProfile(user);
  }

  async updateProfile(userId: string, input: { displayName?: string | undefined; avatarUrl?: string | null | undefined }): Promise<AuthUserProfile> {
    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
    }
    if (input.avatarUrl !== undefined) {
      data.avatarUrl = input.avatarUrl;
    }

    const user = await this.userRepo.update(userId, data);

    return this.authUserMapper.toProfile(user);
  }

  async changePassword(userId: string, input: ChangePasswordOutput): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(input.currentPassword!, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect current password');
    }

    const passwordHash = await bcrypt.hash(input.newPassword!, this.passwordSaltRounds);
    await this.userRepo.update(userId, { passwordHash });
  }
}
