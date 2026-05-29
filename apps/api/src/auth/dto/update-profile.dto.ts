import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name cannot be empty').optional(),
  avatarUrl: z.string().url('Avatar must be a valid URL').nullable().optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
