import { createZodDto } from 'nestjs-zod';
import { changePasswordSchema } from '@odd-note-app/validation';

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
