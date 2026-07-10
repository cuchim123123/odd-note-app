import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './env.validation';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT_TOKEN,
        inject: [ConfigService],
        useFactory: (configService: ConfigService<EnvConfig, true>) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'odd-note-api-client',
              brokers: [configService.get('KAFKA_BROKER')],
            },
            consumer: {
              groupId: 'odd-note-consumer-group',
            },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaConfigModule {}
