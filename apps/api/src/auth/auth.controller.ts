import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
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
    return await this.emailVerificationService.verifyEmailToken(token);
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
}
