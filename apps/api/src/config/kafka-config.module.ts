import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { EnvConfig } from './env.validation';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT_TOKEN,
        inject: ['ENV_CONFIG'],
        useFactory: (env: EnvConfig) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'odd-note-api-client',
              brokers: [env.KAFKA_BROKER],
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
