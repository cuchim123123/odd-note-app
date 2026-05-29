import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {
    getPasswordSaltRounds() {
      return 12;
    }
  },
  JwtConfigService: class JwtConfigService {},
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcryptjs';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { RefreshUseCase } from '../application/use-cases/refresh.use-case';

function createMocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
  };

  const authConfig = {
    getPasswordSaltRounds: vi.fn(() => 12),
  };

  const sessionTokenService = {
    generateAndStoreTokens: vi.fn(),
    revokeRefreshToken: vi.fn(),
    rotateRefreshToken: vi.fn(),
  };

  const authUserMapper = {
    toProfile: vi.fn(),
  };

  const emailVerificationService = {
    createTokenForUser: vi.fn(),
    sendVerificationForUser: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRepo: any = {
    findById: vi.fn(async (id: string) => {
      return prisma.user.findUnique({ where: { id } });
    }),
    findByEmail: vi.fn(async (email: string) => {
      return prisma.user.findUnique({ where: { email } });
    }),
    create: vi.fn(async (data: { email: string; displayName: string; passwordHash: string }) => {
      return prisma.user.create({ data });
    }),
    update: vi.fn(async (id: string, data: { displayName?: string; avatarUrl?: string | null; passwordHash?: string; isEmailVerified?: boolean }) => {
      return prisma.user.update({ where: { id }, data });
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unitOfWork: any = {
    execute: vi.fn(async (callback: (ctx: { userRepository: typeof userRepo; tokenRepository: unknown }) => Promise<unknown>) => {
      return callback({ userRepository: userRepo, tokenRepository: {} });
    }),
  };

  const registerUseCase = new RegisterUseCase(
    userRepo as never,
    unitOfWork as never,
    authConfig as never,
    sessionTokenService as never,
    authUserMapper as never,
    emailVerificationService as never,
  );

  const loginUseCase = new LoginUseCase(
    userRepo as never,
    sessionTokenService as never,
    authUserMapper as never,
  );

  const changePasswordUseCase = new ChangePasswordUseCase(
    userRepo as never,
    authConfig as never,
  );

  const refreshUseCase = new RefreshUseCase(
    sessionTokenService as never,
  );

  return {
    registerUseCase,
    loginUseCase,
    changePasswordUseCase,
    refreshUseCase,
    prisma,
    unitOfWork,
    authConfig,
    sessionTokenService,
    authUserMapper,
    emailVerificationService,
  };
}

describe('Auth Use Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RegisterUseCase', () => {
    it('registers a user, sends verification, and returns profile & tokens', async () => {
      vi.mocked(bcrypt.hash).mockImplementation(async () => 'hashed-password');

      const { registerUseCase, prisma, unitOfWork, sessionTokenService, authUserMapper, emailVerificationService } = createMocks();

      const createdUser = {
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        passwordHash: 'hashed-password',
        role: 'USER',
        isEmailVerified: false,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
        updatedAt: new Date('2026-05-12T00:00:00.000Z'),
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createdUser);
      emailVerificationService.createTokenForUser.mockResolvedValue('verification-token');
      emailVerificationService.sendVerificationForUser.mockResolvedValue(undefined);
      sessionTokenService.generateAndStoreTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      authUserMapper.toProfile.mockReturnValue({
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        role: 'USER',
        isEmailVerified: false,
      });

      const result = await registerUseCase.execute({
        email: 'user@example.com',
        displayName: 'User Example',
        password: 'Password123!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
      expect(emailVerificationService.createTokenForUser).toHaveBeenCalledWith('user-123', expect.anything());
      expect(emailVerificationService.sendVerificationForUser).toHaveBeenCalledWith(createdUser, 'verification-token');
      expect(sessionTokenService.generateAndStoreTokens).toHaveBeenCalledWith('user-123');
      expect(authUserMapper.toProfile).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'user@example.com',
          displayName: 'User Example',
          role: 'USER',
          isEmailVerified: false,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('rejects registration when email already exists', async () => {
      const { registerUseCase, prisma, unitOfWork, sessionTokenService, emailVerificationService } = createMocks();

      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        registerUseCase.execute({
          email: 'user@example.com',
          displayName: 'User Example',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(unitOfWork.execute).not.toHaveBeenCalled();
      expect(sessionTokenService.generateAndStoreTokens).not.toHaveBeenCalled();
      expect(emailVerificationService.createTokenForUser).not.toHaveBeenCalled();
    });
  });

  describe('LoginUseCase', () => {
    it('authenticates with valid credentials and returns auth data', async () => {
      const { loginUseCase, prisma, sessionTokenService, authUserMapper } = createMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        passwordHash: 'hashed-password',
        role: 'USER',
        isEmailVerified: true,
      });
      vi.mocked(bcrypt.compare).mockImplementation(async () => true);
      sessionTokenService.generateAndStoreTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      authUserMapper.toProfile.mockReturnValue({
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        role: 'USER',
        isEmailVerified: true,
      });

      const result = await loginUseCase.execute({
        email: 'user@example.com',
        password: 'Password123!',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed-password');
      expect(sessionTokenService.generateAndStoreTokens).toHaveBeenCalledWith('user-123');
      expect(authUserMapper.toProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-123' }));
      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'user@example.com',
          displayName: 'User Example',
          role: 'USER',
          isEmailVerified: true,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('rejects invalid credentials', async () => {
      const { loginUseCase, prisma, sessionTokenService } = createMocks();

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        passwordHash: 'hashed-password',
        role: 'USER',
        isEmailVerified: true,
      });
      vi.mocked(bcrypt.compare).mockImplementation(async () => false);

      await expect(
        loginUseCase.execute({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(sessionTokenService.generateAndStoreTokens).not.toHaveBeenCalled();
    });
  });

  describe('RefreshUseCase', () => {
    it('delegates refresh token rotation to SessionTokenService', async () => {
      const { refreshUseCase, sessionTokenService } = createMocks();
      sessionTokenService.rotateRefreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await expect(refreshUseCase.execute('refresh-token')).resolves.toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(sessionTokenService.rotateRefreshToken).toHaveBeenCalledWith('refresh-token');
    });
  });
});
