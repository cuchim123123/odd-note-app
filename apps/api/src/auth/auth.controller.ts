import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { registerSchema, type RegisterInput } from '@odd-note-app/validation';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body(new ZodValidationPipe(registerSchema)) registerInput: RegisterInput) {
    return await this.authService.register(registerInput);
  }
}
