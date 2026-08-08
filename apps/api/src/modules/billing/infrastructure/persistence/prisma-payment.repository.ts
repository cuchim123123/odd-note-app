import { Injectable, Optional, Inject } from '@nestjs/common';
import type { IPaymentRepository } from '@modules/billing/application/ports/repositories/payment.repository.port';
import { Payment } from '@modules/billing/domain/aggregates/payment.aggregate';
import type { PaymentStatus } from '@modules/billing/domain/aggregates/payment.aggregate';
import { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';
import { Money } from '@modules/billing/domain/value-objects/money.vo';
import { PlanVersion } from '@modules/billing/domain/value-objects/plan-version.vo';
import { ProviderReference } from '@modules/billing/domain/value-objects/provider-reference.vo';
import type { PaymentProvider } from '@modules/billing/domain/value-objects/provider-reference.vo';
import type { SupportedCurrency } from '@modules/billing/domain/value-objects/money.vo';
import type { PrismaTransactionClient } from '@modules/billing/infrastructure/persistence/prisma-client.type';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(
    private readonly prisma: PrismaTransactionClient,
    @Optional() @Inject('AGGREGATE_TRACKER') private readonly tracker?: AggregateTracker,
  ) {}

  async save(payment: Payment): Promise<void> {
    if (this.tracker) this.tracker.track(payment);
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      create: {
        id: payment.id,
        billingEntityId: payment.billingEntityId,
        planId: payment.planVersion.planId,
        planVersion: payment.planVersion.version,
        amountCents: payment.quote.amountCents,
        currency: payment.quote.currency,
        status: payment.status,
        provider: payment.providerRef?.provider ?? null,
        externalId: payment.providerRef?.externalId ?? null,
        failureReason: payment.failureReason,
        correlationId: payment.correlationId,
        idempotencyKey: payment.idempotencyKey,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
      update: {
        status: payment.status,
        provider: payment.providerRef?.provider ?? null,
        externalId: payment.providerRef?.externalId ?? null,
        failureReason: payment.failureReason,
        updatedAt: payment.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { externalId } });
    return row ? this.toDomain(row) : null;
  }

  async findByBillingEntityAndIdempotencyKey(
    billingEntityId: string,
    idempotencyKey: string,
  ): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({
      where: { billingEntityId_idempotencyKey: { billingEntityId, idempotencyKey } },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string; billingEntityId: string; planId: string; planVersion: number;
    amountCents: number; currency: string; status: string; provider: string | null;
    externalId: string | null; failureReason: string | null; correlationId: string;
    idempotencyKey: string; createdAt: Date; updatedAt: Date;
  }): Payment {
    return Payment.reconstitute({
      id: row.id,
      billingEntityId: BillingEntityId.from(row.billingEntityId),
      planVersion: PlanVersion.of(row.planId, row.planVersion),
      quote: Money.of(row.amountCents, row.currency as SupportedCurrency),
      status: row.status as PaymentStatus,
      providerRef: row.provider && row.externalId
        ? ProviderReference.of(row.provider as PaymentProvider, row.externalId)
        : null,
      failureReason: row.failureReason,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
