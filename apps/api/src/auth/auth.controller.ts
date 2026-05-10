import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Req() request: Request, @Body() input: RegisterDto) {
    const verificationBaseUrl = `${request.protocol}://${request.get('host')}`;
    return await this.authService.register(input, verificationBaseUrl);
  }

  @Post('login')
  async login(@Body() input: LoginDto) {
    return await this.authService.login(input);
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return await this.authService.verifyEmail(token);
  }
}
