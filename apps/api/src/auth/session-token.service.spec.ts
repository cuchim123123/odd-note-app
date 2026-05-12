import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  JwtConfigService: class JwtConfigService {},
}));

import { SessionTokenService } from './session-token.service';

type TransactionClientMock = {
  refreshToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createService() {
  const prisma = {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
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

  const service = new SessionTokenService(prisma as never, jwtService as never, jwtConfig as never);

  return { service, prisma, jwtService, jwtConfig };
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
    const { service, prisma, jwtService } = createService();
    jwtService.verify.mockReturnValue({ sub: 'user-123', type: 'refresh' });
    prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
      const tx: TransactionClientMock = {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'token-1',
            userId: 'user-123',
            expiresAt: new Date('2026-05-19T00:00:00.000Z'),
            revokedAt: new Date('2026-05-12T00:00:00.000Z'),
          }),
          updateMany: vi.fn(),
          create: vi.fn(),
        },
      };
      return callback(tx);
    });

    await expect(service.rotateRefreshToken('refresh.jwt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows only one concurrent refresh rotation to succeed', async () => {
    const { service, prisma, jwtService } = createService();
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

    prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
      const tx: TransactionClientMock = {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue(state.tokenRecord),
          updateMany: vi.fn(async () => {
            if (state.tokenRecord.revokedAt || state.tokenRecord.expiresAt < new Date()) {
              return { count: 0 };
            }

            state.tokenRecord.revokedAt = new Date('2026-05-12T00:00:00.000Z');
            return { count: 1 };
          }),
          create: vi.fn(async () => undefined),
        },
      };
      return callback(tx);
    });

    const results = await Promise.allSettled([
      service.rotateRefreshToken('refresh.jwt'),
      service.rotateRefreshToken('refresh.jwt'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(state.tokenRecord.revokedAt).not.toBeNull();
  });
});
