import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import type { EnvConfig } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());

  const env = app.get<EnvConfig>('ENV_CONFIG');
  const port = env.API_PORT;
  await app.listen(port);
}

void bootstrap();
