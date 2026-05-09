import { Injectable, ConflictException, Inject, UnauthorizedException } from '@nestjs/common';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { EnvConfig } from '../config/config.module';
import type { LoginInput, RegisterInput } from '@odd-note-app/validation';

export type RegisterResult = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LoginResult = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
};

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ENV_CONFIG') private readonly env: EnvConfig,
  ) {
    this.passwordSaltRounds = Number(env.PASSWORD_SALT_ROUNDS ?? 12);
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    // keep a pre-check for nicer fast-fail, but also handle unique-constraint
    // race conditions by catching Prisma P2002 errors on create
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
      // Handle unique constraint errors robustly (P2002)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // This can happen in a race where another process created the user
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
