import { Injectable } from '@nestjs/common';
import type { IEntitlementRepository, UpsertEntitlementDto } from '@modules/billing/application/ports/repositories/entitlement.repository.port';
import type { PrismaTransactionClient } from '@modules/billing/infrastructure/persistence/prisma-client.type';

@Injectable()
export class PrismaEntitlementRepository implements IEntitlementRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async upsert(dto: UpsertEntitlementDto): Promise<void> {
    await this.prisma.entitlementRecord.upsert({
      where: { billingEntityId: dto.billingEntityId },
      create: {
        billingEntityId: dto.billingEntityId,
        features: dto.features,
        expiresAt: dto.expiresAt,
      },
      update: {
        features: dto.features,
        expiresAt: dto.expiresAt,
      },
    });
  }

  async findByBillingEntityId(
    billingEntityId: string,
  ): Promise<{ features: string[]; expiresAt: Date | null } | null> {
    const row = await this.prisma.entitlementRecord.findUnique({
      where: { billingEntityId },
      select: { features: true, expiresAt: true },
    });
    return row ?? null;
  }
}
