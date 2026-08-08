import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { HandleSubscriptionRenewedCommand } from '@modules/billing/application/commands/handle-subscription-renewed/handle-subscription-renewed.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';

@CommandHandler(HandleSubscriptionRenewedCommand)
export class HandleSubscriptionRenewedHandler implements ICommandHandler<HandleSubscriptionRenewedCommand> {
  private readonly logger = new Logger(HandleSubscriptionRenewedHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: HandleSubscriptionRenewedCommand): Promise<void> {
    const { webhookEventId, stripeSubscriptionId, provider, newPeriodEndTimestamp, correlationId } = command;

    await this.uow.execute(async ({ repos }) => {
      const isNew = await repos.processedWebhookEvent.insertIfNotExists(webhookEventId, provider);
      if (!isNew) {
        this.logger.log(`[Webhook] Duplicate event ${webhookEventId} — skipping`);
        return;
      }

      const subscription = await repos.subscription.findByStripeSubscriptionId(stripeSubscriptionId);
      if (!subscription) {
        throw new NotFoundException(`Subscription with stripeSubscriptionId ${stripeSubscriptionId} not found`);
      }

      const newPeriodEnd = new Date(newPeriodEndTimestamp * 1000);
      subscription.renew(newPeriodEnd, correlationId);
      await repos.subscription.save(subscription);

      // Extend entitlement record for the new period
      await repos.entitlement.upsert({
        billingEntityId: subscription.billingEntityId,
        features: [...subscription.features],
        expiresAt: newPeriodEnd,
      });

      this.logger.log(
        `[Webhook] Subscription ${subscription.id} RENEWED — new period end: ${newPeriodEnd.toISOString()}`,
      );
    });
  }
}
