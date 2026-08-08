import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { HandleSubscriptionCancelledCommand } from '@modules/billing/application/commands/handle-subscription-cancelled/handle-subscription-cancelled.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';

@CommandHandler(HandleSubscriptionCancelledCommand)
export class HandleSubscriptionCancelledHandler implements ICommandHandler<HandleSubscriptionCancelledCommand> {
  private readonly logger = new Logger(HandleSubscriptionCancelledHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: HandleSubscriptionCancelledCommand): Promise<void> {
    const { webhookEventId, stripeSubscriptionId, provider, correlationId } = command;

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

      subscription.cancel(correlationId);
      await repos.subscription.save(subscription);

      // Revoke premium access — revert to free plan features, no expiry
      await repos.entitlement.upsert({
        billingEntityId: subscription.billingEntityId,
        features: ['basic_notes'],
        expiresAt: null, // null = permanent free access
      });

      this.logger.log(
        `[Webhook] Subscription ${subscription.id} CANCELLED for billingEntityId=${subscription.billingEntityId}`,
      );
    });
  }
}
