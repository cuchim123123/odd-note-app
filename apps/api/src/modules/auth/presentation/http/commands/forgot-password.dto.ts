import { createZodDto } from 'nestjs-zod';
import { forgotPasswordSchema } from '@odd-note-app/validation';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
