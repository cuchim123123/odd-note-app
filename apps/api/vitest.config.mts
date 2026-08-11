import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    env: {
      APP_URL: 'http://localhost',
      DATABASE_URL: 'postgres://dummy',
      REDIS_URL: 'redis://dummy',
      JWT_ACCESS_SECRET: 'dummy123456789012345678901234567890',
      JWT_REFRESH_SECRET: 'dummy123456789012345678901234567890',
      SMTP_HOST: 'dummy',
      SMTP_PORT: '25',
      SMTP_FROM: 'test@test.com',
      S3_ENDPOINT: 'dummy',
      S3_PORT: '9000',
      S3_ACCESS_KEY: 'dummy',
      S3_SECRET_KEY: 'dummy',
      S3_BUCKET: 'dummy'
    }
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
});
