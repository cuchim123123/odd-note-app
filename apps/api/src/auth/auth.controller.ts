import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AppConfigService } from '../config';
import { RegisterDto, LoginDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    const appUrl = this.appConfig.getAppUrl();
    return await this.authService.register(input, appUrl);
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
