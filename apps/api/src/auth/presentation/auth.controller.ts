import { Body, Controller, Get, Param, Patch, Post, UseGuards, Inject, UseFilters } from '@nestjs/common';
import { USER_REPOSITORY } from '../application/ports/user.repository.port';
import type { UserRepository } from '../application/ports/user.repository.port';
import { TOKEN_PROVIDER } from '../application/ports/token-provider.port';
import type { TokenProvider } from '../application/ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../application/ports/token.repository.port';
import type { TokenRepository } from '../application/ports/token.repository.port';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto, ResendVerificationDto, UpdateProfileDto } from './dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Use cases
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { RefreshUseCase } from '../application/use-cases/refresh.use-case';
import { ForgotPasswordUseCase } from '../application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../application/use-cases/reset-password.use-case';
import { GetCurrentUserUseCase } from '../application/use-cases/get-current-user.use-case';
import { UpdateProfileUseCase } from '../application/use-cases/update-profile.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { VerifyEmailUseCase } from '../application/use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from '../application/use-cases/resend-verification.use-case';

import { AuthErrorFilter } from './filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    return await this.registerUseCase.execute(input);
  }

  @Post('login')
  async login(@Body() input: LoginDto) {
    return await this.loginUseCase.execute(input);
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return await this.verifyEmailUseCase.execute(token.trim());
  }

  @Post('resend-verification')
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.resendVerificationUseCase.execute(input.email!);
    return { success: true, message: 'If the email is registered and unverified, a new verification link has been sent.' };
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() userId: string) {
    return await this.getCurrentUserUseCase.execute(userId);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() userId: string, @Body() input: UpdateProfileDto) {
    return await this.updateProfileUseCase.execute(userId, input);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('change-password')
  async changePassword(@CurrentUser() userId: string, @Body() input: ChangePasswordDto) {
    await this.changePasswordUseCase.execute(userId, input);
    return { success: true, message: 'Password changed successfully' };
  }

  @Post('refresh')
  async refresh(@Body() input: RefreshTokenDto) {
    return await this.refreshUseCase.execute(input.refreshToken!);
  }

  @Post('logout')
  async logout(@Body() input: RefreshTokenDto) {
    await this.logoutUseCase.execute(input.refreshToken!);
    return { success: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.forgotPasswordUseCase.execute(input.email!);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(input.token!, input.password!);
    return { message: 'Password reset successfully' };
  }

  // Development-only: generate a reset token for an email and return the raw token.
  // This endpoint is intentionally gated and should NOT be enabled in production.
  @Post('test/generate-reset-token')
  async generateResetTokenForTest(@Body() body: { email: string }) {
    const allow = process.env.ALLOW_TEST_ENDPOINTS === '1' || process.env.NODE_ENV === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const user = await this.userRepo.findByEmail(body.email);
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();
    await this.tokenRepo.createResetToken({
      tokenHash,
      expiresAt,
      userId: user.id,
    });
    return { token: rawToken };
  }

  // Development-only: test login endpoint that returns auth tokens for test automation.
  // Bypasses email verification requirement for test convenience.
  @Post('test/login')
  async testLogin(@Body() input: LoginDto) {
    const allow = process.env.ALLOW_TEST_ENDPOINTS === '1' || process.env.NODE_ENV === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    return await this.loginUseCase.execute(input);
  }
}
