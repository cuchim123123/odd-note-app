import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
  JwtConfigService: class JwtConfigService {},
}));

vi.mock('../email-verification.service', () => ({
  EmailVerificationService: class EmailVerificationService {}
}));

vi.mock('../password-reset-token.service', () => ({
  PasswordResetTokenService: class PasswordResetTokenService {}
}));

vi.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {}
}));

import { AuthController } from '../presentation/auth.controller';
import type { SessionTokenService } from '../application/services/session-token.service';
import type { EmailVerificationService } from '../application/services/email-verification.service';
import type { PasswordResetTokenService } from '../application/services/password-reset-token.service';
import type { UserRepository } from '../application/ports/user.repository.port';

// Use case types
import type { RegisterUseCase } from '../application/use-cases/register.use-case';
import type { LoginUseCase } from '../application/use-cases/login.use-case';
import type { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import type { RefreshUseCase } from '../application/use-cases/refresh.use-case';
import type { ForgotPasswordUseCase } from '../application/use-cases/forgot-password.use-case';
import type { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import type { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case';
import type { UpdateProfileUseCase } from '../application/use-cases/update-profile.use-case';

function createController() {
  const registerUseCase = {
    execute: vi.fn(),
  };

  const loginUseCase = {
    execute: vi.fn(),
  };

  const changePasswordUseCase = {
    execute: vi.fn(),
  };

  const refreshUseCase = {
    execute: vi.fn(),
  };

  const forgotPasswordUseCase = {
    execute: vi.fn(),
  };

  const resetPasswordUseCase = {
    execute: vi.fn(),
  };

  const getCurrentUserUseCase = {
    execute: vi.fn(),
  };

  const updateProfileUseCase = {
    execute: vi.fn(),
  };

  const sessionTokenService = {
    revokeRefreshToken: vi.fn(),
  };

  const emailVerificationService = {
    verifyEmailToken: vi.fn(),
    resendVerificationEmail: vi.fn(),
  };

  const passwordResetTokenService = {
    createTokenForUser: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRepo: any = {
    findByEmail: vi.fn(),
  };

  const controller = new AuthController(
    registerUseCase as unknown as RegisterUseCase,
    loginUseCase as unknown as LoginUseCase,
    changePasswordUseCase as unknown as ChangePasswordUseCase,
    refreshUseCase as unknown as RefreshUseCase,
    forgotPasswordUseCase as unknown as ForgotPasswordUseCase,
    resetPasswordUseCase as unknown as ResetPasswordUseCase,
    getCurrentUserUseCase as unknown as GetCurrentUserUseCase,
    updateProfileUseCase as unknown as UpdateProfileUseCase,
    sessionTokenService as unknown as SessionTokenService,
    emailVerificationService as unknown as EmailVerificationService,
    passwordResetTokenService as unknown as PasswordResetTokenService,
    userRepo as unknown as UserRepository,
  );

  return {
    controller,
    registerUseCase,
    loginUseCase,
    changePasswordUseCase,
    refreshUseCase,
    forgotPasswordUseCase,
    resetPasswordUseCase,
    getCurrentUserUseCase,
    updateProfileUseCase,
    sessionTokenService,
    emailVerificationService,
    passwordResetTokenService,
    userRepo,
  };
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates register to RegisterUseCase', async () => {
    const { controller, registerUseCase } = createController();
    const input = { email: 'test@test.com', displayName: 'Test', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    registerUseCase.execute.mockResolvedValue(expectedResult);

    const result = await controller.register(input);

    expect(registerUseCase.execute).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedResult);
  });

  it('delegates login to LoginUseCase', async () => {
    const { controller, loginUseCase } = createController();
    const input = { email: 'test@test.com', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: true }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    loginUseCase.execute.mockResolvedValue(expectedResult);

    const result = await controller.login(input);

    expect(loginUseCase.execute).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedResult);
  });

  it('delegates verifyEmail to EmailVerificationService', async () => {
    const { controller, emailVerificationService } = createController();
    const token = 'some-valid-token';
    const expectedResult = { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: true };

    emailVerificationService.verifyEmailToken.mockResolvedValue(expectedResult);

    const result = await controller.verifyEmail(token);

    expect(emailVerificationService.verifyEmailToken).toHaveBeenCalledWith(token);
    expect(result).toEqual(expectedResult);
  });

  it('returns the current user profile from GetCurrentUserUseCase', async () => {
    const { controller, getCurrentUserUseCase } = createController();
    const expectedResult = { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false };

    getCurrentUserUseCase.execute.mockResolvedValue(expectedResult);

    const result = await controller.me('user-1');

    expect(getCurrentUserUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expectedResult);
  });

  it('delegates refresh to RefreshUseCase', async () => {
    const { controller, refreshUseCase } = createController();
    const input = { refreshToken: 'r' };
    const expectedResult = { accessToken: 'a2', refreshToken: 'r2' };

    refreshUseCase.execute.mockResolvedValue(expectedResult);

    const result = await controller.refresh(input);

    expect(refreshUseCase.execute).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual(expectedResult);
  });

  it('delegates logout to SessionTokenService', async () => {
    const { controller, sessionTokenService } = createController();
    const input = { refreshToken: 'r' };

    sessionTokenService.revokeRefreshToken.mockResolvedValue(undefined);

    const result = await controller.logout(input);

    expect(sessionTokenService.revokeRefreshToken).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual({ success: true });
  });
});
