import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import type { EnvConfig } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());

  const env = app.get<EnvConfig>('ENV_CONFIG');

  // Enable CORS for the web frontend (development origin)
  // Uses configured APP_URL when available, falls back to default dev port.
  app.enableCors({
    origin: env.APP_URL ?? 'http://localhost:5173',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  const port = env.API_PORT;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
