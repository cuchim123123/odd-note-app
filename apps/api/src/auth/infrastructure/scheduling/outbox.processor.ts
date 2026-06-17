import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import type { OutboxMessage } from '@prisma/client';
import { MAIL_SENDER } from '../../application/ports/mail-sender.port';
import type { MailSender } from '../../application/ports/mail-sender.port';
import { IntegrationEvent } from '../../../common/ddd/integration-event';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_SENDER) private readonly mailSender: MailSender,
    private readonly eventBus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutboxMessages() {
    // Process in batches using Postgres FOR UPDATE SKIP LOCKED to prevent race conditions
    // across multiple worker nodes (horizontal scaling).
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
        const payload = JSON.parse(msg.payload);

        if (msg.type === 'INTERNAL_COMMAND') {
          await this.processInternalCommand(msg.topic, payload);
        } else if (msg.type === 'INTEGRATION_EVENT') {
          await this.processIntegrationEvent(msg.topic, payload);
        }

        // Mark as processed
        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.error(`Failed to process outbox message ${msg.id}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Basic error handling - mark as FAILED
        await this.prisma.outboxMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  private async processInternalCommand(topic: string, payload: Record<string, unknown>): Promise<void> {
    switch (topic) {
      case 'SendVerificationEmail':
        await this.mailSender.sendVerificationEmail(
          payload.email as string, 
          payload.displayName as string, 
          payload.verificationToken as string
        );
        break;
      case 'SendPasswordResetEmail':
        await this.mailSender.sendPasswordResetEmail(
          payload.email as string, 
          payload.resetToken as string
        );
        break;
      default:
        this.logger.warn(`Unknown internal command topic: ${topic}`);
    }
  }

  private async processIntegrationEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    // Publish via NestJS EventBus for cross-module communication
    this.logger.debug(`[INTEGRATION EVENT] Topic: ${topic}, Payload: ${JSON.stringify(payload)}`);
    this.eventBus.publish(new IntegrationEvent(topic, payload));
  }
}
