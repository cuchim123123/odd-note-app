import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  JwtConfigService: class JwtConfigService {},
}));

import { SessionTokenService } from '../application/services/session-token.service';

function createService() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ displayName: 'Mock User' }),
    },
  };

  const jwtService = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const jwtConfig = {
    getAccessTokenSignOptions: vi.fn(() => ({ secret: 'access-secret', expiresIn: '15m' })),
    getRefreshTokenSignOptions: vi.fn(() => ({ secret: 'refresh-secret', expiresIn: '7d' })),
    getRefreshTokenExpiryMs: vi.fn(() => 7 * 24 * 60 * 60 * 1000),
    getRefreshTokenSecret: vi.fn(() => 'refresh-secret'),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRepo: any = {
    findById: vi.fn(async (id: string) => {
      return prisma.user.findUnique({ where: { id } });
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenRepo: any = {
    createRefreshToken: vi.fn(async (data: { userId: string; tokenHash: string; expiresAt: Date }) => {
      return prisma.refreshToken.create({ data });
    }),
    findRefreshToken: vi.fn(async (hash: string) => {
      return prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    }),
    revokeRefreshToken: vi.fn(async (hash: string, now: Date) => {
      return prisma.refreshToken.updateMany({
        where: { tokenHash: hash },
        data: { revokedAt: now },
      });
    }),
    updateRefreshTokenRevocation: vi.fn(async (id: string, now: Date) => {
      return prisma.refreshToken.updateMany({
        where: { id },
        data: { revokedAt: now },
      });
    }),
  };

  // Explicit UoW: execute passes ctx with scoped repos to the callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unitOfWork: any = {
    execute: vi.fn(async (callback: (ctx: { userRepository: typeof userRepo; tokenRepository: typeof tokenRepo }) => Promise<unknown>) => {
      return callback({ userRepository: userRepo, tokenRepository: tokenRepo });
    }),
  };

  const service = new SessionTokenService(
    userRepo as never,
    tokenRepo as never,
    unitOfWork as never,
    jwtService as never,
    jwtConfig as never,
  );

  return { service, prisma, jwtService, jwtConfig, userRepo, tokenRepo, unitOfWork };
}

describe('SessionTokenService', () => {
  it('stores hashed refresh token when generating tokens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      const { service, prisma, jwtService } = createService();
      jwtService.sign.mockReturnValueOnce('access.jwt').mockReturnValueOnce('refresh.jwt');

      await service.generateAndStoreTokens('user-123');

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: createHash('sha256').update('refresh.jwt').digest('hex'),
          expiresAt: new Date('2026-05-19T00:00:00.000Z'),
          userId: 'user-123',
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects invalid refresh JWTs before touching the database', async () => {
    const { service, prisma, jwtService } = createService();
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    await expect(service.rotateRefreshToken('broken-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects already revoked refresh tokens', async () => {
    const { service, jwtService, tokenRepo } = createService();
    jwtService.verify.mockReturnValue({ sub: 'user-123', type: 'refresh' });
    tokenRepo.findRefreshToken.mockResolvedValue({
      id: 'token-1',
      userId: 'user-123',
      expiresAt: new Date('2026-05-19T00:00:00.000Z'),
      revokedAt: new Date('2026-05-12T00:00:00.000Z'),
    });

    await expect(service.rotateRefreshToken('refresh.jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows only one concurrent refresh rotation to succeed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      const { service, jwtService, tokenRepo, userRepo } = createService();
      jwtService.verify.mockReturnValue({ sub: 'user-123', type: 'refresh' });
      jwtService.sign.mockReturnValueOnce('access-1').mockReturnValueOnce('refresh-1').mockReturnValueOnce('access-2').mockReturnValueOnce('refresh-2');

      const state = {
        tokenRecord: {
          id: 'token-1',
          userId: 'user-123',
          expiresAt: new Date('2026-05-19T00:00:00.000Z'),
          revokedAt: null as Date | null,
        },
      };

      tokenRepo.findRefreshToken.mockResolvedValue(state.tokenRecord);
      tokenRepo.updateRefreshTokenRevocation.mockImplementation(async () => {
        if (state.tokenRecord.revokedAt || state.tokenRecord.expiresAt < new Date()) {
          return { count: 0 };
        }
        state.tokenRecord.revokedAt = new Date('2026-05-12T00:00:00.000Z');
        return { count: 1 };
      });
      userRepo.findById.mockResolvedValue({ displayName: 'Mock User' });

      const results = await Promise.allSettled([
        service.rotateRefreshToken('refresh.jwt'),
        service.rotateRefreshToken('refresh.jwt'),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(state.tokenRecord.revokedAt).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
