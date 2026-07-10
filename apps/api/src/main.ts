import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import type { EnvConfig } from './config/config.module';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new DomainExceptionFilter(httpAdapter));

  const env = app.get<EnvConfig>('ENV_CONFIG');

  const { CustomIoAdapter } = await import('./common/adapters/custom-io.adapter');
  app.useWebSocketAdapter(new CustomIoAdapter(app, env));

  // Enable CORS for the web frontend (development origin)
  // Uses configured APP_URL when available, falls back to default dev port.
  app.enableCors({
    origin: env.APP_URL ?? 'http://localhost:5173',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-note-unlock-token', 'X-Note-Unlock-Token'],
    credentials: true,
  });

  const port = env.API_PORT;
  
  // Connect Kafka Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [env.KAFKA_BROKER],
        clientId: 'odd-note-api-client',
      },
      consumer: {
        groupId: 'odd-note-consumer-group',
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
