import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config';
import type { LoginInput, RegisterInput } from '@odd-note-app/validation';
import type { AuthUserProfile, LoginResult, RegisterResult } from './auth.types';
import { TokenService } from './token.service';
import { MailerService } from '../common/mailer/mailer.service';

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
    private readonly tokenService: TokenService,
    private readonly mailerService: MailerService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  /**
   * Project user from database record to client-safe profile.
   * Single source of truth for user shape across all auth operations.
   */
  private projectUserProfile(user: User): AuthUserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  /**
   * Register a new user with email verification.
   * The entire flow (user creation → verification token → refresh token) is transactional.
   * Email sending is an async side-effect after the transaction succeeds.
   */
  async register(input: RegisterInput, verificationBaseUrl: string): Promise<RegisterResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Pre-check for nicer fast-fail; also catch Prisma P2002 race conditions on create
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    // Transactional flow: user → verification token → refresh token
    // All must succeed together, or the transaction rolls back.
    const { user, verificationToken } = await this.prisma.$transaction(async (tx) => {
      let newUser: User;
      try {
        newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            displayName: input.displayName.trim(),
            passwordHash,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Email is already registered');
        }
        throw err;
      }

      // Create verification token within the transaction
      const token = await this.tokenService.createAndStoreVerificationToken(newUser.id, tx);

      // Create refresh token within the transaction
      await this.tokenService.generateAndStoreTokens(newUser.id, tx);

      return { user: newUser, verificationToken: token };
    });

    const verificationUrl = `${verificationBaseUrl}/auth/verify-email/${verificationToken}`;

    // Mail sending is async side-effect after transaction succeeds
    // If it fails, the user is already created (they can request a new verification email)
    try {
      await this.mailerService.sendVerificationEmail({
        to: user.email,
        displayName: user.displayName,
        verificationUrl,
      });
    } catch {
      // Log error but don't throw; user exists and can retry verification email
      // error suppressed intentionally - user can retry verification email send
    }

    const tokens = await this.tokenService.generateAndStoreTokens(user.id);

    return {
      user: this.projectUserProfile(user),
      tokens,
    };
  }

  async verifyEmail(token: string): Promise<{ user: AuthUserProfile }> {
    try {
      const userId = await this.tokenService.validateAndUseVerificationToken(token);

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { isEmailVerified: true },
      });

      return { user: this.projectUserProfile(updatedUser) };
    } catch {
      throw new BadRequestException('Verification token is invalid or expired');
    }
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.tokenService.generateAndStoreTokens(user.id);

    return {
      user: this.projectUserProfile(user),
      tokens,
    };
  }
}
