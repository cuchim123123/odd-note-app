import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { AuthService } from './auth.service';

const registerSchema = z
  .object({
    email: z.string().email(),
    displayName: z.string().min(2).max(100),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    try {
      const input = registerSchema.parse(body);
      const { confirmPassword, ...registerInput } = input;
      void confirmPassword;
      return await this.authService.register(registerInput);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.flatten());
      }

      throw error;
    }
  }
}
