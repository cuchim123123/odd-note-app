import { Injectable } from '@nestjs/common';
import type { ISubscriptionRepository } from '@modules/billing/application/ports/repositories/subscription.repository.port';
import { Subscription } from '@modules/billing/domain/aggregates/subscription.aggregate';
import type { SubscriptionStatus } from '@modules/billing/domain/aggregates/subscription.aggregate';
import { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';
import { PlanVersion } from '@modules/billing/domain/value-objects/plan-version.vo';
import type { PrismaTransactionClient } from '@modules/billing/infrastructure/persistence/prisma-client.type';

@Injectable()
export class PrismaSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async save(sub: Subscription): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { id: sub.id },
      create: {
        id: sub.id,
        billingEntityId: sub.billingEntityId,
        planId: sub.planVersion.planId,
        planVersion: sub.planVersion.version,
        paymentId: sub.paymentId,
        status: sub.status,
        features: [...sub.features],
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        cancelledAt: sub.cancelledAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      },
      update: {
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        cancelledAt: sub.cancelledAt,
        updatedAt: sub.updatedAt,
      },
    });
  }

  async findByBillingEntityId(billingEntityId: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findFirst({
      where: { billingEntityId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByPaymentId(paymentId: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findUnique({ where: { paymentId } });
    return row ? this.toDomain(row) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string; billingEntityId: string; planId: string; planVersion: number;
    paymentId: string; status: string; features: string[];
    currentPeriodStart: Date; currentPeriodEnd: Date;
    stripeSubscriptionId: string | null; cancelledAt: Date | null;
    createdAt: Date; updatedAt: Date;
  }): Subscription {
    return Subscription.reconstitute({
      id: row.id,
      billingEntityId: BillingEntityId.from(row.billingEntityId),
      planVersion: PlanVersion.of(row.planId, row.planVersion),
      paymentId: row.paymentId,
      status: row.status as SubscriptionStatus,
      features: row.features,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      stripeSubscriptionId: row.stripeSubscriptionId,
      cancelledAt: row.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
