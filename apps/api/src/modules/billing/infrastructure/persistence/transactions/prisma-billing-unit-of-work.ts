import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BasePrismaUnitOfWork } from '@shared/infrastructure/persistence/base-prisma-unit-of-work';
import type { IBillingUnitOfWork, BillingTransactionContext } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { PrismaPaymentRepository } from '@modules/billing/infrastructure/persistence/prisma-payment.repository';
import { PrismaSubscriptionRepository } from '@modules/billing/infrastructure/persistence/prisma-subscription.repository';
import { PrismaPlanCatalogRepository } from '@modules/billing/infrastructure/persistence/prisma-plan-catalog.repository';
import { PrismaEntitlementRepository } from '@modules/billing/infrastructure/persistence/prisma-entitlement.repository';
import { BILLING_INTEGRATION_EVENT_MAPPER } from '@modules/billing/application/mappers/billing-integration-event.mapper';
import type { BillingIntegrationEventMapper } from '@modules/billing/application/mappers/billing-integration-event.mapper';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaBillingUnitOfWork
  extends BasePrismaUnitOfWork<BillingTransactionContext>
  implements IBillingUnitOfWork
{
  constructor(
    prisma: PrismaService,
    @Inject(BILLING_INTEGRATION_EVENT_MAPPER)
    integrationEventMapper: BillingIntegrationEventMapper,
  ) {
    super(prisma, integrationEventMapper);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected createTransactionContext(tx: any, tracker: AggregateTracker): BillingTransactionContext {
    return {
      repos: {
        payment: new PrismaPaymentRepository(tx, tracker),
        subscription: new PrismaSubscriptionRepository(tx, tracker),
        planCatalog: new PrismaPlanCatalogRepository(tx),
        entitlement: new PrismaEntitlementRepository(tx),
      },
    };
  }
}
