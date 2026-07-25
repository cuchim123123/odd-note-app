import { Injectable, Inject } from '@nestjs/common';
import type { INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';
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

  async scheduleInternalCommand(topic: string, payload: Record<string, unknown>): Promise<void> {
    await this.prisma.outboxMessage.create({
      data: {
        type: 'INTERNAL_COMMAND',
        topic,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });
  }
}

