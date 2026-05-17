import { createZodDto } from 'nestjs-zod';
import { forgotPasswordSchema } from '@odd-note-app/validation';

export class ResendVerificationDto extends createZodDto(forgotPasswordSchema) {}
