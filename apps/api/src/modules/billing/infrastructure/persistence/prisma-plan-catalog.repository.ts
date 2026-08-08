import { Injectable } from '@nestjs/common';
import { Plan } from '@modules/billing/domain/entities/plan.entity';
import type { IPlanCatalogRepository } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import type { PrismaTransactionClient } from '@modules/billing/infrastructure/persistence/prisma-client.type';
import type { SupportedCurrency } from '@modules/billing/domain/value-objects/money.vo';

export class PlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan '${planId}' was not found or is no longer active.`);
    this.name = 'PlanNotFoundError';
  }
}

@Injectable()
export class PrismaPlanCatalogRepository implements IPlanCatalogRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async findActiveById(planId: string): Promise<Plan> {
    const row = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!row) throw new PlanNotFoundError(planId);
    return this.toDomain(row);
  }

  async findAll(): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string; version: number; displayName: string; amountCents: number;
    currency: string; intervalDays: number | null; features: string[];
    isActive: boolean; createdAt: Date; deprecatedAt: Date | null;
  }): Plan {
    return Plan.reconstitute({
      ...row,
      currency: row.currency as SupportedCurrency,
    });
  }
}
