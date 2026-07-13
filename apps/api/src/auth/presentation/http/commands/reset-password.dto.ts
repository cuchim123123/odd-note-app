import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { resetPasswordSchema } from '@odd-note-app/validation';

const resetPasswordDtoSchema = z.intersection(
  resetPasswordSchema,
  z.object({
    token: z.string(),
  }),
);

export class ResetPasswordDto extends createZodDto(resetPasswordDtoSchema) {}
