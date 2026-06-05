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

// Command handlers
import { RegisterHandler } from '../application/commands/register/register.handler';
import { LoginHandler } from '../application/commands/login/login.handler';
import { ChangePasswordHandler } from '../application/commands/change-password/change-password.handler';
import { RefreshTokensHandler } from '../application/commands/refresh-tokens/refresh-tokens.handler';
import { ForgotPasswordHandler } from '../application/commands/forgot-password/forgot-password.handler';
import { ResetPasswordHandler } from '../application/commands/reset-password/reset-password.handler';
import { UpdateProfileHandler } from '../application/commands/update-profile/update-profile.handler';
import { LogoutHandler } from '../application/commands/logout/logout.handler';
import { VerifyEmailHandler } from '../application/commands/verify-email/verify-email.handler';
import { ResendVerificationHandler } from '../application/commands/resend-verification/resend-verification.handler';

// Query handlers
import { GetCurrentUserHandler } from '../application/queries/get-current-user/get-current-user.handler';

// Presentation
import { UserProfileMapper } from './mappers/user-profile.mapper';
import { AuthErrorFilter } from './filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerHandler: RegisterHandler,
    private readonly loginHandler: LoginHandler,
    private readonly changePasswordHandler: ChangePasswordHandler,
    private readonly refreshTokensHandler: RefreshTokensHandler,
    private readonly forgotPasswordHandler: ForgotPasswordHandler,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    private readonly getCurrentUserHandler: GetCurrentUserHandler,
    private readonly updateProfileHandler: UpdateProfileHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly resendVerificationHandler: ResendVerificationHandler,
    private readonly userProfileMapper: UserProfileMapper,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    const { user, tokens } = await this.registerHandler.execute(input);
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }

  @Post('login')
  async login(@Body() input: LoginDto) {
    const { user, tokens } = await this.loginHandler.execute(input);
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    const { user } = await this.verifyEmailHandler.execute(token.trim());
    return { user: this.userProfileMapper.toProfile(user) };
  }

  @Post('resend-verification')
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.resendVerificationHandler.execute(input.email!);
    return { success: true, message: 'If the email is registered and unverified, a new verification link has been sent.' };
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() userId: string) {
    const user = await this.getCurrentUserHandler.execute(userId);
    return this.userProfileMapper.toProfile(user);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() userId: string, @Body() input: UpdateProfileDto) {
    const user = await this.updateProfileHandler.execute(userId, input);
    return this.userProfileMapper.toProfile(user);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('change-password')
  async changePassword(@CurrentUser() userId: string, @Body() input: ChangePasswordDto) {
    await this.changePasswordHandler.execute(userId, input);
    return { success: true, message: 'Password changed successfully' };
  }

  @Post('refresh')
  async refresh(@Body() input: RefreshTokenDto) {
    return await this.refreshTokensHandler.execute(input.refreshToken!);
  }

  @Post('logout')
  async logout(@Body() input: RefreshTokenDto) {
    await this.logoutHandler.execute(input.refreshToken!);
    return { success: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.forgotPasswordHandler.execute(input.email!);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.resetPasswordHandler.execute(input.token!, input.password!);
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

    const { user, tokens } = await this.loginHandler.execute(input);
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }
}
