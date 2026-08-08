import type { Plan } from '@modules/billing/domain/entities/plan.entity';

export const PLAN_CATALOG_REPOSITORY = Symbol('PLAN_CATALOG_REPOSITORY');

export interface IPlanCatalogRepository {
  /** Returns the active plan by ID. Throws if not found or deprecated. */
  findActiveById(planId: string): Promise<Plan>;
  findAll(): Promise<Plan[]>;
}
