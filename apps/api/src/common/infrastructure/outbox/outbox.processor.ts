import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientKafka } from '@nestjs/microservices';
import type { OutboxMessage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { KAFKA_CLIENT_TOKEN } from '../../../config/kafka-config.module';
import {
  INTERNAL_COMMAND_HANDLERS,
  type IInternalCommandHandler,
} from './internal-command-handler.port';

/**
 * Generic Transactional Outbox Processor.
 *
 * Polls the OutboxMessage table every 10 seconds using
 * FOR UPDATE SKIP LOCKED to prevent double-processing across replicas.
 *
 * Message routing:
 *  - INTEGRATION_EVENT  → published to Kafka
 *  - INTERNAL_COMMAND   → delegated to a registered IInternalCommandHandler
 *                         (each bounded context registers its own handler)
 *
 * This processor is domain-agnostic. It contains zero bounded-context logic.
 */
@Injectable()
export class OutboxProcessor implements OnModuleInit {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KAFKA_CLIENT_TOKEN)
    private readonly kafkaClient: ClientKafka,
    /**
     * All IInternalCommandHandler implementations registered across modules.
     * Optional so the processor starts even if no handlers are registered.
     */
    @Optional()
    @Inject(INTERNAL_COMMAND_HANDLERS)
    private readonly commandHandlers: IInternalCommandHandler[] = [],
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutboxMessages(): Promise<void> {
    const messages = await this.prisma.$queryRaw<OutboxMessage[]>`
      UPDATE "OutboxMessage"
      SET status = 'PROCESSING'
      WHERE id IN (
        SELECT id
        FROM "OutboxMessage"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    if (messages.length === 0) return;

    this.logger.debug(`Processing ${messages.length} outbox messages...`);

    for (const msg of messages) {
      try {
        const payload = JSON.parse(msg.payload) as Record<string, unknown>;

        if (msg.type === 'INTERNAL_COMMAND') {
          await this.dispatchInternalCommand(msg.topic, payload);
        } else if (msg.type === 'INTEGRATION_EVENT') {
          await this.publishIntegrationEvent(msg.topic, payload);
        }

        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      } catch (error) {
        this.logger.error(
          `Failed to process outbox message ${msg.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  private async dispatchInternalCommand(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const handler = this.commandHandlers.find((h) => h.canHandle(topic));
    if (!handler) {
      this.logger.warn(
        `No IInternalCommandHandler registered for internal command topic: "${topic}"`,
      );
      return;
    }
    await handler.handle(topic, payload);
  }

  private publishIntegrationEvent(
    topic: string,
    payload: Record<string, unknown>,
  ): void {
    this.logger.debug(`[KAFKA PUBLISH] Topic: ${topic}, Payload: ${JSON.stringify(payload)}`);
    this.kafkaClient.emit(topic, payload);
  }
}
