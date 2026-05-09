import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
