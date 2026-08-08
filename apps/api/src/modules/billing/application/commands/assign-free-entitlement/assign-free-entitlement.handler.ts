import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { AssignFreeEntitlementCommand } from '@modules/billing/application/commands/assign-free-entitlement/assign-free-entitlement.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';

@CommandHandler(AssignFreeEntitlementCommand)
export class AssignFreeEntitlementHandler implements ICommandHandler<AssignFreeEntitlementCommand> {
  private readonly logger = new Logger(AssignFreeEntitlementHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
  ) {}

  async execute(command: AssignFreeEntitlementCommand): Promise<void> {
    const { userId, correlationId } = command;
    void correlationId; // could be used for tracing or logging
    const billingEntityId = BillingEntityId.fromUser(userId);

    await this.uow.execute(async ({ repos }) => {
      // 1. Check if an entitlement already exists (idempotency)
      const existing = await repos.entitlement.findByBillingEntityId(billingEntityId);
      if (existing) {
        this.logger.log(`[Billing] Entitlement already exists for user ${userId}, skipping free entitlement assignment`);
        return;
      }

      // 2. Fetch the free plan from the catalog
      const freePlan = await repos.planCatalog.findActiveById('free');

      // 3. Create initial free entitlement
      await repos.entitlement.upsert({
        billingEntityId,
        features: [...freePlan.features],
        expiresAt: null, // null means never expires
      });

      this.logger.log(`[Billing] Assigned free entitlement for user ${userId}`);
    });
  }
}
