import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccessTokenGuard } from './access-token.guard';
import { CurrentUser } from './current-user.decorator';
import type { AccessTokenPayload } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    return await this.authService.register(input);
  }

  @Post('login')
  async login(@Body() input: LoginDto) {
    return await this.authService.login(input);
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return await this.emailVerificationService.verifyEmailToken(token.trim());
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload) {
    return await this.authService.getCurrentUser(user.sub!);
  }

  @Post('refresh')
  async refresh(@Body() input: RefreshTokenDto) {
    return await this.authService.refresh(input.refreshToken);
  }

  @Post('logout')
  async logout(@Body() input: RefreshTokenDto) {
    await this.authService.logout(input.refreshToken);
    return { success: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.passwordResetService.sendResetPasswordEmail(input.email);
    // Always return success for security (don't reveal whether email exists)
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(input.token, input.password);
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

    // Create token and return raw token for test automation.
    const user = await this.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      // Don't reveal whether the email exists; return same shape as the real endpoint
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Create a raw token via the token service (returns raw token to send to user)
    const raw = await this.passwordResetTokenService.createTokenForUser(user.id);
    return { token: raw };
  }
}
