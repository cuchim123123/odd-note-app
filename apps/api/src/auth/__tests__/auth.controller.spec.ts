import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config', () => ({
  AuthConfigService: class AuthConfigService {},
  JwtConfigService: class JwtConfigService {},
}));

vi.mock('../auth.service', () => ({
  AuthService: class AuthService {}
}));

vi.mock('../email-verification.service', () => ({
  EmailVerificationService: class EmailVerificationService {}
}));

vi.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {}
}));

import { AuthController } from '../auth.controller';
import type { AuthService } from '../auth.service';
import type { EmailVerificationService } from '../email-verification.service';
import type { PasswordResetService } from '../password-reset.service';

function createController() {
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    getCurrentUser: vi.fn(),
  };

  const emailVerificationService = {
    verifyEmailToken: vi.fn(),
  };

  const passwordResetService = {
    sendResetPasswordEmail: vi.fn(),
    resetPassword: vi.fn(),
  };

  const controller = new AuthController(
    authService as unknown as AuthService,
    emailVerificationService as unknown as EmailVerificationService,
    passwordResetService as unknown as PasswordResetService,
  );

  return {
    controller,
    authService,
    emailVerificationService,
    passwordResetService,
  };
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates register to AuthService', async () => {
    const { controller, authService } = createController();
    const input = { email: 'test@test.com', displayName: 'Test', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    authService.register.mockResolvedValue(expectedResult);

    const result = await controller.register(input);

    expect(authService.register).toHaveBeenCalledWith(input);
    expect(result).toEqual(expectedResult);
  });

  it('delegates login to AuthService', async () => {
    const { controller, authService } = createController();
    const input = { email: 'test@test.com', password: 'Password123!' };
    const expectedResult = { user: { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: true }, tokens: { accessToken: 'a', refreshToken: 'r' } };

    authService.login.mockResolvedValue(expectedResult);

    const result = await controller.login(input);

    expect(authService.login).toHaveBeenCalledWith(input);
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

  it('returns the current user profile from the access token', async () => {
    const { controller, authService } = createController();
    const expectedResult = { id: '1', email: 'test@test.com', displayName: 'Test', role: 'USER', isEmailVerified: false };

    authService.getCurrentUser.mockResolvedValue(expectedResult);

    const result = await controller.me({ sub: 'user-1', type: 'access' });

    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expectedResult);
  });

  it('delegates refresh to AuthService', async () => {
    const { controller, authService } = createController();
    const input = { refreshToken: 'r' };
    const expectedResult = { accessToken: 'a2', refreshToken: 'r2' };

    authService.refresh.mockResolvedValue(expectedResult);

    const result = await controller.refresh(input);

    expect(authService.refresh).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual(expectedResult);
  });

  it('delegates logout to AuthService', async () => {
    const { controller, authService } = createController();
    const input = { refreshToken: 'r' };

    authService.logout.mockResolvedValue(undefined);

    const result = await controller.logout(input);

    expect(authService.logout).toHaveBeenCalledWith(input.refreshToken);
    expect(result).toEqual({ success: true });
  });
});
