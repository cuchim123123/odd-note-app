import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { EmailVerificationService } from './email-verification.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
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
}
