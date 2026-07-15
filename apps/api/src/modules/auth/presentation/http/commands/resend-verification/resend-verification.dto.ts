import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const resendVerificationSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
