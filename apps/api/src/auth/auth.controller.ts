import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import type { RegisterInput } from '@odd-note-app/validation';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    return await this.authService.register(input as RegisterInput);
  }
}
