import { createZodDto } from 'nestjs-zod';
import { loginSchema } from '@odd-note-app/validation';

export class LoginDto extends createZodDto(loginSchema) {}
