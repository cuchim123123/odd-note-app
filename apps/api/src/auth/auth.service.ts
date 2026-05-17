import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config';
import type { LoginInput, RegisterInput } from '@odd-note-app/validation';
import type { AuthTokens, AuthUserProfile, LoginResult, RegisterResult } from './auth.types';
import { SessionTokenService } from './session-token.service';
import { AuthUserMapper } from './auth-user.mapper';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
    private readonly emailVerificationService: EmailVerificationService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }


  async register(input: RegisterInput): Promise<RegisterResult> {
    // Pre-check for nicer fast-fail; also catch Prisma P2002 race conditions on create
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    // Transactional flow: user → verification token
    // All must succeed together, or the transaction rolls back.
    const { user, verificationToken } = await this.prisma.$transaction(async (tx) => {
      let newUser: User;
      try {
        newUser = await tx.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            passwordHash,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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
    const user = await this.prisma.user.findUnique({
      where: { email: input.email! },
    });

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.authUserMapper.toProfile(user);
  }

  async updateProfile(userId: string, input: { displayName?: string; avatarUrl?: string | null }): Promise<AuthUserProfile> {
    const data: Prisma.UserUpdateInput = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
    }
    if (input.avatarUrl !== undefined) {
      data.avatarUrl = input.avatarUrl;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return this.authUserMapper.toProfile(user);
  }
}
