import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { HandleSubscriptionPaymentFailedCommand } from '@modules/billing/application/commands/handle-subscription-payment-failed/handle-subscription-payment-failed.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';

// Grace period: keep basic access for 3 days after failed renewal
const GRACE_PERIOD_DAYS = 3;

@CommandHandler(HandleSubscriptionPaymentFailedCommand)
export class HandleSubscriptionPaymentFailedHandler implements ICommandHandler<HandleSubscriptionPaymentFailedCommand> {
  private readonly logger = new Logger(HandleSubscriptionPaymentFailedHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: HandleSubscriptionPaymentFailedCommand): Promise<void> {
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

      subscription.markPastDue(correlationId);
      await repos.subscription.save(subscription);

      // Downgrade to free features + short grace period — do NOT revoke immediately
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      await repos.entitlement.upsert({
        billingEntityId: subscription.billingEntityId,
        features: ['basic_notes'], // Grace: downgrade to free features
        expiresAt: gracePeriodEnd,
      });

      this.logger.warn(
        `[Webhook] Subscription ${subscription.id} PAST_DUE — grace period until ${gracePeriodEnd.toISOString()}`,
      );
    });
  }
}
