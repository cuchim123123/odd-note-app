import { Injectable, Inject } from '@nestjs/common';
import type { IPlanCatalogRepository } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import { PLAN_CATALOG_REPOSITORY } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import type { Plan } from '@modules/billing/domain/entities/plan.entity';
import { Money } from '@modules/billing/domain/value-objects/money.vo';
import type { SupportedCurrency } from '@modules/billing/domain/value-objects/money.vo';

export class PlanNotActiveError extends Error {
  constructor(planId: string) {
    super(`Plan '${planId}' does not exist or is no longer active.`);
    this.name = 'PlanNotActiveError';
  }
}

/**
 * PricingService — Domain Service.
 * Resolves the authoritative price for a plan.
 * Future: applies discounts, promotional codes, regional pricing.
 * The client NEVER supplies the price — it is always computed here.
 */
@Injectable()
export class PricingService {
  constructor(
    @Inject(PLAN_CATALOG_REPOSITORY)
    private readonly planCatalog: IPlanCatalogRepository,
  ) {}

  async getQuote(planId: string): Promise<{ plan: Plan; quote: Money }> {
    const plan = await this.planCatalog.findActiveById(planId);
    const quote = Money.of(plan.amountCents, plan.currency as SupportedCurrency);
    return { plan, quote };
  }
}
