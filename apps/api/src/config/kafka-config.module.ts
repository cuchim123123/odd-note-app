import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: KAFKA_CLIENT_TOKEN,
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'odd-note-api-client',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
          consumer: {
            groupId: 'odd-note-consumer-group',
          },
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaConfigModule {}
