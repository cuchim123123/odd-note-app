import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
}));

import { VerificationTokenService } from '../verification-token.service';

type TransactionClientMock = {
  verificationToken: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createService() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authConfig: any = {
    getEmailVerificationTokenExpiryMs: vi.fn(() => 24 * 60 * 60 * 1000), // 24 hours
  };

  const service = new VerificationTokenService(prisma as never, authConfig as never);

  return { service, prisma, authConfig };
}

describe('VerificationTokenService', () => {
  it('creates and stores verification token with correct hash and expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      const { service } = createService();

      const txClient = {
        verificationToken: {
          create: vi.fn(),
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
      };

      await service.createAndStoreVerificationToken('user-123', txClient as never);

      expect(txClient.verificationToken.create).toHaveBeenCalledWith({
        data: {
          tokenHash: expect.any(String), // SHA256 hash
          expiresAt: new Date('2026-05-13T00:00:00.000Z'), // Now + 24h
          userId: 'user-123',
        },
      });

      const callArgs = txClient.verificationToken.create.mock.calls[0]![0];
      expect(callArgs.data.tokenHash).toHaveLength(64); // SHA256 hex is 64 chars
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects non-existent verification tokens', async () => {
    const { service, prisma } = createService();

    prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
      const tx: TransactionClientMock = {
        verificationToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue(null), // Token not found
          updateMany: vi.fn(),
        },
      };
      return callback(tx);
    });

    await expect(service.validateAndUseVerificationToken('invalid-token')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateAndUseVerificationToken('invalid-token')).rejects.toThrow('Verification token is invalid or expired');
  });

  it('rejects already-used verification tokens', async () => {
    const { service, prisma } = createService();

    prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
      const tx: TransactionClientMock = {
        verificationToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            id: 'token-1',
            tokenHash: createHash('sha256').update('valid-token').digest('hex'),
            userId: 'user-123',
            expiresAt: new Date('2026-05-13T00:00:00.000Z'),
            usedAt: new Date('2026-05-12T12:00:00.000Z'), // Already used
          }),
          updateMany: vi.fn(),
        },
      };
      return callback(tx);
    });

    await expect(service.validateAndUseVerificationToken('valid-token')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.validateAndUseVerificationToken('valid-token')).rejects.toThrow('Verification token is invalid or expired');
  });

  it('rejects expired verification tokens', async () => {
    const { service, prisma } = createService();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T00:00:00.000Z'));

    try {
      prisma.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
        const tx: TransactionClientMock = {
          verificationToken: {
            create: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({
              id: 'token-1',
              tokenHash: createHash('sha256').update('expired-token').digest('hex'),
              userId: 'user-123',
              expiresAt: new Date('2026-05-13T00:00:00.000Z'), // Expired (before now)
              usedAt: null,
            }),
            updateMany: vi.fn(),
          },
        };
        return callback(tx);
      });

      await expect(service.validateAndUseVerificationToken('expired-token')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.validateAndUseVerificationToken('expired-token')).rejects.toThrow('Verification token is invalid or expired');
    } finally {
      vi.useRealTimers();
    }
  });

  it('atomically consumes token only once even with concurrent attempts', async () => {
    const { service, prisma: prismaService } = createService();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));

    try {
      const tokenState = {
        id: 'token-1',
        tokenHash: createHash('sha256').update('concurrent-token').digest('hex'),
        userId: 'user-123',
        expiresAt: new Date('2026-05-13T00:00:00.000Z'),
        usedAt: null as Date | null,
        consumeCount: 0,
      };

      prismaService.$transaction.mockImplementation(async (callback: (tx: TransactionClientMock) => Promise<unknown>) => {
        const tx: TransactionClientMock = {
          verificationToken: {
            create: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({ ...tokenState }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateMany: vi.fn(async (args: any) => {
              // Simulate atomic update: only succeed if conditions match
              const now = new Date();
              if (
                tokenState.id === args.where.id &&
                tokenState.usedAt === null &&
                tokenState.expiresAt > now
              ) {
                tokenState.usedAt = now;
                tokenState.consumeCount++;
                return { count: 1 };
              }
              return { count: 0 };
            }),
          },
        };
        return callback(tx);
      });

      const results = await Promise.allSettled([
        service.validateAndUseVerificationToken('concurrent-token'),
        service.validateAndUseVerificationToken('concurrent-token'),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(tokenState.consumeCount).toBe(1); // Only one succeeded
      const firstFulfilled = fulfilled[0]!;
      expect(firstFulfilled.status === 'fulfilled' && firstFulfilled.value).toBe('user-123');
    } finally {
      vi.useRealTimers();
    }
  });
});
