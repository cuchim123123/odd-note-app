import { createZodDto } from 'nestjs-zod';
import { refreshTokenSchema } from '@odd-note-app/validation';

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
