import type { OutboxPort } from '@modules/auth/application/ports/outbox.port';
import type { PrismaTransactionClient } from '@modules/auth/infrastructure/persistence/prisma-client.type';

export class PrismaOutboxRepository implements OutboxPort {
  constructor(private readonly prisma: PrismaTransactionClient) {}

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
