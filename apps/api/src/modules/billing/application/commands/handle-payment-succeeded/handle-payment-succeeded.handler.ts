import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { HandlePaymentSucceededCommand } from '@modules/billing/application/commands/handle-payment-succeeded/handle-payment-succeeded.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { Subscription } from '@modules/billing/domain/aggregates/subscription.aggregate';

@CommandHandler(HandlePaymentSucceededCommand)
export class HandlePaymentSucceededHandler implements ICommandHandler<HandlePaymentSucceededCommand> {
  private readonly logger = new Logger(HandlePaymentSucceededHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: HandlePaymentSucceededCommand): Promise<void> {
    const { webhookEventId, externalId, provider, correlationId } = command;

    await this.uow.execute(async ({ repos }) => {
      // ── Step 1: Idempotency check (MUST be first — same transaction) ────────
      const isNew = await repos.processedWebhookEvent.insertIfNotExists(webhookEventId, provider);
      if (!isNew) {
        this.logger.log(`[Webhook] Duplicate event ${webhookEventId} — skipping`);
        return;
      }

      // ── Step 2: Load Payment (FOR UPDATE via raw query in repo impl) ────────
      const payment = await repos.payment.findByExternalId(externalId);
      if (!payment) {
        throw new NotFoundException(`Payment with externalId ${externalId} not found`);
      }
      if (payment.status === 'COMPLETED') {
        this.logger.warn(`[Webhook] Payment ${payment.id} already COMPLETED — idempotent skip`);
        return;
      }

      // ── Step 3: Load active Plan (snapshotted at initiation) ───────────────
      const plan = await repos.planCatalog.findActiveById(payment.planVersion.planId);

      // ── Step 4: Domain transition ──────────────────────────────────────────
      payment.complete();
      await repos.payment.save(payment);

      // ── Step 5: Create and persist Subscription ────────────────────────────
      const subscription = Subscription.activate(payment, plan, correlationId);
      await repos.subscription.save(subscription);

      // ── Step 6: Upsert Entitlement record (authoritative read model) ────────
      await repos.entitlement.upsert({
        billingEntityId: payment.billingEntityId,
        features: [...plan.features],
        expiresAt: plan.computePeriodEnd(subscription.currentPeriodStart),
      });

      this.logger.log(
        `[Webhook] Payment ${payment.id} COMPLETED → Subscription ${subscription.id} ACTIVE for billingEntityId=${payment.billingEntityId}`,
      );
    });
  }
}
