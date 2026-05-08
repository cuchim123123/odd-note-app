import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ZodError } from 'zod';
import { AuthService } from './auth.service';
import { registerSchema } from '@odd-note-app/validation';
import type { RegisterInput, RawRegisterInput } from '@odd-note-app/validation';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    try {
      const input = registerSchema.parse(body) as RawRegisterInput;
      const registerInput = { ...input } as unknown as RegisterInput;
      delete (registerInput as unknown as Record<string, unknown>).confirmPassword;
      return await this.authService.register(registerInput);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.flatten());
      }

      throw error;
    }
  }
}
