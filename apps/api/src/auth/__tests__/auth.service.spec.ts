import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
  JwtConfigService: class JwtConfigService {},
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';

type TransactionClientMock = {
  user: {
    create: ReturnType<typeof vi.fn>;
  };
};

function createService() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
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

  const service = new AuthService(
    prisma as never,
    authConfig as never,
    sessionTokenService as never,
    authUserMapper as never,
    emailVerificationService as never,
  );

  return {
    service,
    prisma,
    authConfig,
    sessionTokenService,
    authUserMapper,
    emailVerificationService,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a user, sends the verification email, and returns auth data', async () => {
    vi.mocked(bcrypt.hash).mockImplementation(async () => 'hashed-password');

    const { service, prisma, sessionTokenService, authUserMapper, emailVerificationService } = createService();

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
    prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
      const tx: TransactionClientMock = {
        user: {
          create: vi.fn().mockResolvedValue(createdUser),
        },
      };

      emailVerificationService.createTokenForUser.mockResolvedValue('verification-token');
      return callback(tx);
    });
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

    const result = await service.register({
      email: 'user@example.com',
      displayName: 'User Example',
      password: 'Password123!',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(emailVerificationService.createTokenForUser).toHaveBeenCalledWith('user-123', expect.any(Object));
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

  it('rejects registration when the email already exists', async () => {
    const { service, prisma, sessionTokenService, emailVerificationService } = createService();

    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'user@example.com',
        displayName: 'User Example',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sessionTokenService.generateAndStoreTokens).not.toHaveBeenCalled();
    expect(emailVerificationService.createTokenForUser).not.toHaveBeenCalled();
  });

  it('logs in with valid credentials and returns auth data', async () => {
    const { service, prisma, sessionTokenService, authUserMapper } = createService();

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

    const result = await service.login({
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

  it('rejects invalid login credentials', async () => {
    const { service, prisma, sessionTokenService } = createService();

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
      service.login({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionTokenService.generateAndStoreTokens).not.toHaveBeenCalled();
  });

  it('delegates logout and refresh token handling', async () => {
    const { service, sessionTokenService } = createService();
    sessionTokenService.rotateRefreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    await service.logout('refresh-token');
    await expect(service.refresh('refresh-token')).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    expect(sessionTokenService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(sessionTokenService.rotateRefreshToken).toHaveBeenCalledWith('refresh-token');
  });
});