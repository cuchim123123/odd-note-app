import { BadRequestException, Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import type { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { JwtConfigService } from '../config';

type AccessTokenPayload = {
  sub?: string;
  type?: string;
};

const tokenSchema = z.string().trim().min(1, 'token is required');

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
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
    return await this.emailVerificationService.verifyEmailToken(this.parseToken(token));
  }

  @Get('me')
  async me(@Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.authService.getCurrentUser(userId);
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

  private parseToken(token: string): string {
    const parsed = tokenSchema.safeParse(token);
    if (!parsed.success) {
      throw new BadRequestException('Invalid token');
    }

    return parsed.data;
  }

  private resolveUserId(authorizationHeader?: string): string {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.jwtConfig.getAccessTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    if (!payload.sub || payload.type === 'refresh') {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    return payload.sub;
  }
}
