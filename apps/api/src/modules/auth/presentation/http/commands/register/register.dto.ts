import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '@odd-note-app/validation';

export class RegisterDto extends createZodDto(registerSchema) {}
