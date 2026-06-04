import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
  JwtConfigService: class JwtConfigService {},
}));

import type { TokenProvider } from '../application/ports/token-provider.port';
import type { UserRepository } from '../application/ports/user.repository.port';
import { AuthController } from '../presentation/auth.controller';

// Use case types
import type { RegisterHandler } from '../application/commands/register/register.handler';
import type { LoginHandler } from '../application/commands/login/login.handler';
import type { ChangePasswordHandler } from '../application/commands/change-password/change-password.handler';
import type { RefreshTokensHandler } from '../application/commands/refresh-tokens/refresh-tokens.handler';
import type { ForgotPasswordHandler } from '../application/commands/forgot-password/forgot-password.handler';
import type { ResetPasswordHandler } from '../application/commands/reset-password/reset-password.handler';
import type { GetCurrentUserHandler } from '../application/queries/get-current-user/get-current-user.handler';
import type { UpdateProfileHandler } from '../application/commands/update-profile/update-profile.handler';
import type { VerifyEmailHandler } from '../application/commands/verify-email/verify-email.handler';
import type { ResendVerificationHandler } from '../application/commands/resend-verification/resend-verification.handler';
import type { LogoutHandler } from '../application/commands/logout/logout.handler';

function createController() {
  const registerHandler = {
    execute: vi.fn(),
  };

  const loginHandler = {
    execute: vi.fn(),
  };

  const changePasswordHandler = {
    execute: vi.fn(),
  };

  const refreshTokensHandler = {
    execute: vi.fn(),
  };

  const forgotPasswordHandler = {
    execute: vi.fn(),
  };

  const resetPasswordHandler = {
    execute: vi.fn(),
  };

  const getCurrentUserHandler = {
    execute: vi.fn(),
  };

  const updateProfileHandler = {
    execute: vi.fn(),
  };

  const verifyEmailHandler = {
    execute: vi.fn(),
  };

  const resendVerificationHandler = {
    execute: vi.fn(),
  };

  const logoutHandler = {
    execute: vi.fn(),
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
    registerHandler as unknown as RegisterHandler,
    loginHandler as unknown as LoginHandler,
    changePasswordHandler as unknown as ChangePasswordHandler,
    refreshTokensHandler as unknown as RefreshTokensHandler,
    forgotPasswordHandler as unknown as ForgotPasswordHandler,
    resetPasswordHandler as unknown as ResetPasswordHandler,
    getCurrentUserHandler as unknown as GetCurrentUserHandler,
    updateProfileHandler as unknown as UpdateProfileHandler,
    logoutHandler as unknown as LogoutHandler,
    verifyEmailHandler as unknown as VerifyEmailHandler,
    resendVerificationHandler as unknown as ResendVerificationHandler,
    tokenProvider as unknown as TokenProvider,
    tokenRepo,
    userRepo as unknown as UserRepository,
  );

  return {
    controller,
    registerHandler,
    loginHandler,
    changePasswordHandler,
    refreshTokensHandler,
    forgotPasswordHandler,
    resetPasswordHandler,
    getCurrentUserHandler,
    updateProfileHandler,
    logoutHandler,
    verifyEmailHandler,
    resendVerificationHandler,
    tokenProvider,
    tokenRepo,
    userRepo,
  };
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates register to RegisterHandler', async () => {
    const { controller, registerHandler } = createController();
    const input = { email: 'test@test.com', displayName: 'Test', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    registerHandler.execute.mockResolvedValue(expectedResult);

    const result = await controller.register(input);

    expect(registerHandler.execute).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedResult);
  });

  it('delegates login to LoginHandler', async () => {
    const { controller, loginHandler } = createController();
    const input = { email: 'test@test.com', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: true }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    loginHandler.execute.mockResolvedValue(expectedResult);

    const result = await controller.login(input);

    expect(loginHandler.execute).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedResult);
  });

  it('delegates verifyEmail to VerifyEmailHandler', async () => {
    const { controller, verifyEmailHandler } = createController();
    const token = 'some-valid-token';
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: true } };

    verifyEmailHandler.execute.mockResolvedValue(expectedResult);

    const result = await controller.verifyEmail(token);

    expect(verifyEmailHandler.execute).toHaveBeenCalledWith(token);
    expect(result).toEqual(expectedResult);
  });

  it('returns the current user profile from GetCurrentUserHandler', async () => {
    const { controller, getCurrentUserHandler } = createController();
    const expectedResult = { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false };

    getCurrentUserHandler.execute.mockResolvedValue(expectedResult);

    const result = await controller.me('user-1');

    expect(getCurrentUserHandler.execute).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expectedResult);
  });

  it('delegates refresh to RefreshTokensHandler', async () => {
    const { controller, refreshTokensHandler } = createController();
    const input = { refreshToken: 'r' };
    const expectedResult = { accessToken: 'a2', refreshToken: 'r2' };

    refreshTokensHandler.execute.mockResolvedValue(expectedResult);

    const result = await controller.refresh(input);

    expect(refreshTokensHandler.execute).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual(expectedResult);
  });

  it('delegates logout to LogoutHandler', async () => {
    const { controller, logoutHandler } = createController();
    const input = { refreshToken: 'r' };

    logoutHandler.execute.mockResolvedValue(undefined);

    const result = await controller.logout(input);

    expect(logoutHandler.execute).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual({ success: true });
  });
});
