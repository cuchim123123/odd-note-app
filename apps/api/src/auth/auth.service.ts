import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config/auth-config.module';
import { JwtConfigService } from '../config/jwt-config.service';
import type { LoginInput, RegisterInput } from '@odd-note-app/validation';
import type { AuthTokens, AuthUserProfile, LoginResult, RegisterResult } from './auth.types';

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
    private readonly authConfig: AuthConfigService,
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
   * Generate JWT access + refresh token pair and store refresh token in database.
   * Refresh tokens are persisted for logout/invalidation and token rotation security.
   */
  private async generateAndStoreTokens(userId: string): Promise<AuthTokens> {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      this.jwtConfig.getAccessTokenSignOptions(),
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      this.jwtConfig.getRefreshTokenSignOptions(),
    );

    // Hash refresh token before storing for security (breach resistance)
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiryMs = this.jwtConfig.getRefreshTokenExpiryMs();
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Pre-check for nicer fast-fail; also catch Prisma P2002 race conditions on create
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, this.passwordSaltRounds);

    let user;
    try {
      user = await this.prisma.user.create({
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

    const tokens = await this.generateAndStoreTokens(user.id);

    return {
      user: this.projectUserProfile(user),
      tokens,
    };
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

    const tokens = await this.generateAndStoreTokens(user.id);

    return {
      user: this.projectUserProfile(user),
      tokens,
    };
  }
}
