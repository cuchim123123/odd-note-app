import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
  JwtConfigService: class JwtConfigService {},
}));


import { AuthController } from '../presentation/auth.controller';
import type { UserProfileMapper } from '../presentation/mappers/user-profile.mapper';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

// Commands & Queries
import { RegisterCommand } from '../application/commands/register/register.command';
import { LoginCommand } from '../application/commands/login/login.command';
import { VerifyEmailCommand } from '../application/commands/verify-email/verify-email.command';
import { GetCurrentUserQuery } from '../application/queries/get-current-user/get-current-user.query';
import { RefreshTokensCommand } from '../application/commands/refresh-tokens/refresh-tokens.command';
import { LogoutCommand } from '../application/commands/logout/logout.command';

// Shared profile shape returned by the profile mapper
const mockProfile = { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER' as const, isEmailVerified: false, avatarUrl: null };

function createController() {
  const commandBus = {
    execute: vi.fn(),
  };

  const queryBus = {
    execute: vi.fn(),
  };

  const userProfileMapper = {
    toProfile: vi.fn(() => mockProfile),
  };

  const tokenProvider = {
    generatePasswordResetToken: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenRepo: any = {
    createResetToken: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRepo: any = {
    findByEmail: vi.fn(),
  };

  const controller = new AuthController(
    commandBus as unknown as CommandBus,
    queryBus as unknown as QueryBus,
    userProfileMapper as unknown as UserProfileMapper,



  );

  return {
    controller,
    commandBus,
    queryBus,
    userProfileMapper,
    tokenProvider,
    tokenRepo,
    userRepo,
  };
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates register to commandBus and maps to profile', async () => {
    const { controller, commandBus, userProfileMapper } = createController();
    const input = { email: 'test@test.com', displayName: 'Test', password: 'Password123!' };
    const domainUser = { id: '1', email: 'test@test.com', displayName: 'Test' };
    const tokens = { accessToken: 'a', refreshToken: 'r' };

    commandBus.execute.mockResolvedValue({ user: domainUser, tokens });

    const result = await controller.register(input);

    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(RegisterCommand));
    expect(userProfileMapper.toProfile).toHaveBeenCalledWith(domainUser);
    expect(result).toEqual({ user: mockProfile, tokens });
  });

  it('delegates login to commandBus and maps to profile', async () => {
    const { controller, commandBus, userProfileMapper } = createController();
    const input = { email: 'test@test.com', password: 'Password123!' };
    const domainUser = { id: '1', email: 'test@test.com', displayName: 'Test' };
    const tokens = { accessToken: 'a', refreshToken: 'r' };

    commandBus.execute.mockResolvedValue({ user: domainUser, tokens });

    const result = await controller.login(input);

    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(LoginCommand));
    expect(userProfileMapper.toProfile).toHaveBeenCalledWith(domainUser);
    expect(result).toEqual({ user: mockProfile, tokens });
  });

  it('delegates verifyEmail to commandBus and maps to profile', async () => {
    const { controller, commandBus, userProfileMapper } = createController();
    const token = 'some-valid-token';
    const domainUser = { id: '1', email: 'test@test.com', isEmailVerified: true };

    commandBus.execute.mockResolvedValue({ user: domainUser });

    const result = await controller.verifyEmail(token);

    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(VerifyEmailCommand));
    expect(userProfileMapper.toProfile).toHaveBeenCalledWith(domainUser);
    expect(result).toEqual({ user: mockProfile });
  });

  it('delegates me to queryBus and maps to profile', async () => {
    const { controller, queryBus, userProfileMapper } = createController();
    const domainUser = { id: '1', email: 'test@test.com', displayName: 'Test' };

    queryBus.execute.mockResolvedValue(domainUser);

    const result = await controller.me('user-1');

    expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetCurrentUserQuery));
    expect(userProfileMapper.toProfile).toHaveBeenCalledWith(domainUser);
    expect(result).toEqual(mockProfile);
  });

  it('delegates refresh to commandBus', async () => {
    const { controller, commandBus } = createController();
    const input = { refreshToken: 'r' };
    const expectedResult = { accessToken: 'a2', refreshToken: 'r2' };

    commandBus.execute.mockResolvedValue(expectedResult);

    const result = await controller.refresh(input);

    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(RefreshTokensCommand));
    expect(result).toEqual(expectedResult);
  });

  it('delegates logout to commandBus', async () => {
    const { controller, commandBus } = createController();
    const input = { refreshToken: 'r' };

    commandBus.execute.mockResolvedValue(undefined);

    const result = await controller.logout(input);

    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(LogoutCommand));
    expect(result).toEqual({ success: true });
  });
});
