import { Injectable } from '@nestjs/common';
import type { IProcessedWebhookEventRepository } from '@modules/billing/application/ports/repositories/processed-webhook-event.repository.port';
import type { PrismaTransactionClient } from '@modules/billing/infrastructure/persistence/prisma-client.type';

@Injectable()
export class PrismaProcessedWebhookEventRepository implements IProcessedWebhookEventRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async insertIfNotExists(webhookEventId: string, provider: string): Promise<boolean> {
    try {
      await this.prisma.processedWebhookEvent.create({
        data: { webhookEventId, provider },
      });
      return true; // Insert succeeded → new event, safe to process
    } catch (err: unknown) {
      // Unique constraint violation = duplicate event → skip
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        return false;
      }
      throw err; // Re-throw unexpected errors
    }
  }
}
