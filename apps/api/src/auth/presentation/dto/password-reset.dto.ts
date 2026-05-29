import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { forgotPasswordSchema, resetPasswordSchema } from '@odd-note-app/validation';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

const resetPasswordDtoSchema = z.intersection(
  resetPasswordSchema,
  z.object({
    token: z.string(),
  }),
);

export class ResetPasswordDto extends createZodDto(resetPasswordDtoSchema) {}
