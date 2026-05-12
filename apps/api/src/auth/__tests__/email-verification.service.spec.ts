import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
}));

import { EmailVerificationService } from '../email-verification.service';

function createService() {
  const prisma = {
    user: {
      update: vi.fn(),
    },
  };

  const verificationTokenService = {
    createAndStoreVerificationToken: vi.fn(),
    validateAndUseVerificationToken: vi.fn(),
  };

  const authUrlService = {
    buildVerificationEmailUrl: vi.fn(),
  };

  const mailerService = {
    sendVerificationEmail: vi.fn(),
  };

  const authUserMapper = {
    toProfile: vi.fn(),
  };

  const service = new EmailVerificationService(
    prisma as never,
    verificationTokenService as never,
    authUrlService as never,
    mailerService as never,
    authUserMapper as never,
  );

  return {
    service,
    prisma,
    verificationTokenService,
    authUrlService,
    mailerService,
    authUserMapper,
  };
}

describe('EmailVerificationService', () => {
  it('delegates verification token creation to the token service', async () => {
    const { service, verificationTokenService } = createService();
    verificationTokenService.createAndStoreVerificationToken.mockResolvedValue('verification-token');

    const result = await service.createTokenForUser('user-123', { tx: true } as never);

    expect(verificationTokenService.createAndStoreVerificationToken).toHaveBeenCalledWith('user-123', { tx: true });
    expect(result).toBe('verification-token');
  });

  it('builds the verification url and sends the email', async () => {
    const { service, authUrlService, mailerService } = createService();
    authUrlService.buildVerificationEmailUrl.mockReturnValue('https://app.test/auth/verify-email/token-123');
    mailerService.sendVerificationEmail.mockResolvedValue(undefined);

    await service.sendVerificationForUser(
      {
        email: 'user@example.com',
        displayName: 'User Example',
      } as never,
      'token-123',
    );

    expect(authUrlService.buildVerificationEmailUrl).toHaveBeenCalledWith('token-123');
    expect(mailerService.sendVerificationEmail).toHaveBeenCalledWith({
      to: 'user@example.com',
      displayName: 'User Example',
      verificationUrl: 'https://app.test/auth/verify-email/token-123',
    });
  });

  it('verifies the token, activates the user, and maps the updated profile', async () => {
    const { service, prisma, verificationTokenService, authUserMapper } = createService();
    verificationTokenService.validateAndUseVerificationToken.mockResolvedValue('user-123');

    const updatedUser = {
      id: 'user-123',
      email: 'user@example.com',
      displayName: 'User Example',
      passwordHash: 'hashed-password',
      role: 'USER',
      isEmailVerified: true,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    };

    prisma.user.update.mockResolvedValue(updatedUser);
    authUserMapper.toProfile.mockReturnValue({
      id: 'user-123',
      email: 'user@example.com',
      displayName: 'User Example',
      role: 'USER',
      isEmailVerified: true,
    });

    const result = await service.verifyEmailToken('token-123');

    expect(verificationTokenService.validateAndUseVerificationToken).toHaveBeenCalledWith('token-123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { isEmailVerified: true },
    });
    expect(authUserMapper.toProfile).toHaveBeenCalledWith(updatedUser);
    expect(result).toEqual({
      user: {
        id: 'user-123',
        email: 'user@example.com',
        displayName: 'User Example',
        role: 'USER',
        isEmailVerified: true,
      },
    });
  });
});
