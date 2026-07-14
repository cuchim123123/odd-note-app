import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { OutboxMessage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { KAFKA_CLIENT_TOKEN } from '../../../config/kafka-config.module';
import {
  INTERNAL_COMMAND_HANDLERS,
  type IInternalCommandHandler,
} from './internal-command-handler.port';

/**
 * Generic Transactional Outbox Processor — with exponential backoff retry
 * and dead-letter queue (DLQ).
 *
 * ─── Retry policy ────────────────────────────────────────────────────────────
 *  Attempt 1 → retry after  10s
 *  Attempt 2 → retry after  30s
 *  Attempt 3 → retry after  2m
 *  Attempt 4 → retry after  10m
 *  Attempt 5 → retry after  1h
 *  Attempt 6+ → status = DEAD_LETTERED, deadLetteredAt = now()
 *
 * DEAD_LETTERED messages are never re-tried automatically. An operator
 * must inspect and manually requeue them (set status = 'PENDING', retryCount = 0).
 *
 * ─── Kafka publish ────────────────────────────────────────────────────────────
 * emit() returns an Observable. We now await it via firstValueFrom() so that a
 * Kafka broker outage is caught as an error and triggers the retry path instead
 * of silently succeeding while the message is lost.
 *
 * ─── Concurrency safety ──────────────────────────────────────────────────────
 * FOR UPDATE SKIP LOCKED prevents double-processing across horizontally
 * scaled replicas. The PROCESSING sentinel prevents re-pickup of in-flight rows.
 *
 * This processor is domain-agnostic — zero bounded-context logic lives here.
 */

/** Maximum number of delivery attempts before dead-lettering. */
const MAX_RETRIES = 5;

/** Backoff delays in milliseconds, indexed by attempt number (1-based). */
const BACKOFF_MS: Record<number, number> = {
  1: 10_000,        //  10 s
  2: 30_000,        //  30 s
  3: 120_000,       //   2 m
  4: 600_000,       //  10 m
  5: 3_600_000,     //   1 h
};

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

  // ─── Main polling loop ───────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutboxMessages(): Promise<void> {
    const now = new Date();

    // Claim PENDING messages that are either new (nextRetryAt IS NULL)
    // or whose retry delay has elapsed (nextRetryAt <= now).
    const messages = await this.prisma.$queryRaw<OutboxMessage[]>`
      UPDATE "OutboxMessage"
      SET status = 'PROCESSING'
      WHERE id IN (
        SELECT id
        FROM "OutboxMessage"
        WHERE status = 'PENDING'
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
        ORDER BY "createdAt" ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    if (messages.length === 0) return;

    this.logger.debug(`Processing ${messages.length} outbox messages...`);

    for (const msg of messages) {
      await this.processOne(msg);
    }
  }

  // ─── Single message processing ───────────────────────────────────────────

  private async processOne(msg: OutboxMessage): Promise<void> {
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
      await this.handleFailure(msg, error);
    }
  }

  // ─── Failure handling — retry or dead-letter ─────────────────────────────

  private async handleFailure(msg: OutboxMessage, error: unknown): Promise<void> {
    const attempt = msg.retryCount + 1;       // this was attempt N
    const nextAttempt = attempt + 1;           // would be attempt N+1

    this.logger.error(
      `Outbox message ${msg.id} [${msg.topic}] failed on attempt ${attempt}/${MAX_RETRIES}: ` +
      (error instanceof Error ? error.message : String(error)),
    );

    if (attempt >= MAX_RETRIES) {
      // All retries exhausted — move to dead-letter
      this.logger.error(
        `Outbox message ${msg.id} [${msg.topic}] exceeded max retries — moving to DEAD_LETTERED`,
      );
      await this.prisma.outboxMessage.update({
        where: { id: msg.id },
        data: {
          status: 'DEAD_LETTERED',
          retryCount: attempt,
          deadLetteredAt: new Date(),
        },
      });
      return;
    }

    // Schedule next retry with exponential backoff
    const delayMs = BACKOFF_MS[nextAttempt] ?? BACKOFF_MS[MAX_RETRIES]!;
    const nextRetryAt = new Date(Date.now() + delayMs);

    this.logger.warn(
      `Scheduling retry ${nextAttempt}/${MAX_RETRIES} for message ${msg.id} [${msg.topic}] at ${nextRetryAt.toISOString()}`,
    );

    await this.prisma.outboxMessage.update({
      where: { id: msg.id },
      data: {
        status: 'PENDING',
        retryCount: attempt,
        nextRetryAt,
      },
    });
  }

  // ─── Dispatch strategies ─────────────────────────────────────────────────

  private async dispatchInternalCommand(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const handler = this.commandHandlers.find((h) => h.canHandle(topic));
    if (!handler) {
      this.logger.warn(
        `No IInternalCommandHandler registered for topic: "${topic}" — message will be retried`,
      );
      // Treat as retriable error so it's not silently swallowed
      throw new Error(`No handler for internal command topic: "${topic}"`);
    }
    await handler.handle(topic, payload);
  }

  /**
   * Awaits the Kafka emit via firstValueFrom() so that broker-level errors
   * are surfaced as exceptions and trigger the retry/DLQ path.
   *
   * Previously this was fire-and-forget (Observable discarded), meaning
   * Kafka errors were silently lost while the message was marked PROCESSED.
   */
  private async publishIntegrationEvent(
    topic: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    this.logger.debug(`[KAFKA] Publish → ${topic}: ${JSON.stringify(payload)}`);
    await firstValueFrom(this.kafkaClient.emit(topic, payload));
  }
}
