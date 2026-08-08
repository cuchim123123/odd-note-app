import type { IPaymentRepository } from '@modules/billing/application/ports/repositories/payment.repository.port';
import type { ISubscriptionRepository } from '@modules/billing/application/ports/repositories/subscription.repository.port';
import type { IPlanCatalogRepository } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import type { IEntitlementRepository } from '@modules/billing/application/ports/repositories/entitlement.repository.port';

export const BILLING_UNIT_OF_WORK = Symbol('BILLING_UNIT_OF_WORK');

export interface BillingTransactionContext {
  repos: {
    payment: IPaymentRepository;
    subscription: ISubscriptionRepository;
    planCatalog: IPlanCatalogRepository;
    entitlement: IEntitlementRepository;
  };
}

export interface IBillingUnitOfWork {
  execute<T>(work: (ctx: BillingTransactionContext) => Promise<T>): Promise<T>;
}
