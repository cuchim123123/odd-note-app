import { z } from 'zod';

export const mongoConfigSchema = z.object({
  MONGO_URI: z.string().url().startsWith('mongodb'),
  MONGO_DB_NAME: z.string().min(1).default('odd_note_projections'),
});

export type MongoConfig = z.infer<typeof mongoConfigSchema>;
