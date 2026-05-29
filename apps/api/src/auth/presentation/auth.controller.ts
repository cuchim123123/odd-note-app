import { Body, Controller, Get, Param, Patch, Post, UseGuards, Inject } from '@nestjs/common';
import { SessionTokenService } from '../application/services/session-token.service';
import { PasswordResetTokenService } from '../application/services/password-reset-token.service';
import { USER_REPOSITORY } from '../domain/ports/user.repository.port';
import type { IUserRepository } from '../domain/ports/user.repository.port';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto, ResendVerificationDto, UpdateProfileDto } from './dto';
import { EmailVerificationService } from '../application/services/email-verification.service';
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
    private readonly sessionTokenService: SessionTokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
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
    return await this.emailVerificationService.verifyEmailToken(token.trim());
  }

  @Post('resend-verification')
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.emailVerificationService.resendVerificationEmail(input.email!);
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
    await this.sessionTokenService.revokeRefreshToken(input.refreshToken!);
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

    const raw = await this.passwordResetTokenService.createTokenForUser(user.id);
    return { token: raw };
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
