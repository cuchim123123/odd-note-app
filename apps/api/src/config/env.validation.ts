import { z } from 'zod';

const durationSchema = z.string().regex(/^\d+[dhms]$/, {
  message: 'Expected duration format like 24h, 15m, 30s, or 7d',
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  API_PORT: z.coerce.number().default(4000),
  API_BASE_PATH: z.string().default('/api'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
  JWT_REFRESH_EXPIRES_IN: durationSchema.default('7d'),
  /** Dedicated secret for note-unlock tokens — MUST differ from access/refresh secrets */
  JWT_NOTE_UNLOCK_SECRET: z.string().min(32),
  JWT_NOTE_UNLOCK_EXPIRES_IN: durationSchema.default('1h'),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().email(),
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN: durationSchema.default('5m'),
  S3_ENDPOINT: z.string(),
  S3_PORT: z.coerce.number(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string(),
  S3_USE_SSL: z.coerce.boolean().default(false),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  PASSWORD_SALT_ROUNDS: z.coerce.number().int().positive().default(12),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
}
