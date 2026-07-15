import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import type { EnvConfig } from '@config/env.validation';

import { ConfigModule } from '@config/config.module';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT_TOKEN,
        imports: [ConfigModule],
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
