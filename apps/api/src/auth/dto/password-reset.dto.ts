import { createZodDto } from 'nestjs-zod';
import { forgotPasswordSchema, resetPasswordSchema } from '@odd-note-app/validation';
import { z } from 'zod';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

const resetPasswordDtoSchema = resetPasswordSchema.and(
  z.object({
    token: z.string().min(1, 'Token is required'),
  })
);

export class ResetPasswordDto extends createZodDto(resetPasswordDtoSchema) {}
