import { Injectable, Inject } from '@nestjs/common';
import type { INoteOutboxPort } from '../../application/ports/note-outbox.port';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { PrismaTransactionClient } from '../persistence/prisma-client.type';
/**
 * Infrastructure adapter: persists integration event messages to the OutboxMessage table.
 * The OutboxProcessor (in AuthModule) polls this table and forwards events to Kafka.
 */
@Injectable()
export class PrismaOutboxAdapter implements INoteOutboxPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  async scheduleIntegrationEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        type: 'INTEGRATION_EVENT',
        topic,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });
  }
}

