import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { HandlePaymentFailedCommand } from '@modules/billing/application/commands/handle-payment-failed/handle-payment-failed.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';

@CommandHandler(HandlePaymentFailedCommand)
export class HandlePaymentFailedHandler implements ICommandHandler<HandlePaymentFailedCommand> {
  private readonly logger = new Logger(HandlePaymentFailedHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: HandlePaymentFailedCommand): Promise<void> {
    const { webhookEventId, externalId, provider, failureReason, correlationId } = command;
    void correlationId;

    await this.uow.execute(async ({ repos }) => {
      const isNew = await repos.processedWebhookEvent.insertIfNotExists(webhookEventId, provider);
      if (!isNew) {
        this.logger.log(`[Webhook] Duplicate event ${webhookEventId} — skipping`);
        return;
      }

      const payment = await repos.payment.findByExternalId(externalId);
      if (!payment) throw new NotFoundException(`Payment with externalId ${externalId} not found`);

      payment.fail(failureReason);
      await repos.payment.save(payment);

      this.logger.log(`[Webhook] Payment ${payment.id} FAILED: ${failureReason}`);
      // No entitlement change — payment was never completed
    });
  }
}
