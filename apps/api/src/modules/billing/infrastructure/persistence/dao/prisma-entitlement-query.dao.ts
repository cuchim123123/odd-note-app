import { Injectable, Logger } from '@nestjs/common';
import type { IEntitlementQueryDao, EntitlementResult } from '@modules/billing/application/ports/dao/entitlement-query.dao.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RedisService } from '@shared/infrastructure/redis/redis.service';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY = (id: string) => `entitlement:v1:${id}`;

@Injectable()
export class PrismaEntitlementQueryDao implements IEntitlementQueryDao {
  private readonly logger = new Logger(PrismaEntitlementQueryDao.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findByBillingEntityId(billingEntityId: string): Promise<EntitlementResult | null> {
    // 1. Fast path — Redis
    const cached = await this.redis.getClient().get(CACHE_KEY(billingEntityId));
    if (cached) {
      const parsed = JSON.parse(cached) as { features: string[]; expiresAt: string | null };
      return this.toResult(billingEntityId, parsed.features, parsed.expiresAt ? new Date(parsed.expiresAt) : null);
    }

    // 2. DB fallback
    const row = await this.prisma.entitlementRecord.findUnique({
      where: { billingEntityId },
      select: { features: true, expiresAt: true },
    });

    if (!row) return null;

    // 3. Populate cache (best-effort — failure is acceptable)
    try {
      await this.redis.getClient().setex(
        CACHE_KEY(billingEntityId),
        CACHE_TTL_SECONDS,
        JSON.stringify({ features: row.features, expiresAt: row.expiresAt?.toISOString() ?? null }),
      );
    } catch (err) {
      this.logger.warn(`Failed to populate entitlement cache for ${billingEntityId}: ${err}`);
    }

    return this.toResult(billingEntityId, row.features, row.expiresAt);
  }

  async hasFeature(billingEntityId: string, featureKey: string): Promise<boolean> {
    const result = await this.findByBillingEntityId(billingEntityId);
    if (!result || !result.isActive) return false;
    return result.features.includes(featureKey);
  }

  private toResult(
    billingEntityId: string,
    features: string[],
    expiresAt: Date | null,
  ): EntitlementResult {
    const isActive = expiresAt === null || expiresAt > new Date();
    return { billingEntityId, features, expiresAt, isActive };
  }
}
