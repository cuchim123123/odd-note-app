import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

interface PlanSeedRecord {
  id: string;
  version: number;
  displayName: string;
  amountCents: number;
  currency: string;
  intervalDays: number | null;
  features: string[];
  isActive: boolean;
}

/**
 * PlanCatalogSeeder — runs on application bootstrap.
 * Uses upsert so re-deploys are idempotent.
 * amountCents for premium plans is read from environment config — never hardcoded.
 */
@Injectable()
export class PlanCatalogSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlanCatalogSeeder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const premiumMonthlyPrice = this.config.get<number>('PREMIUM_MONTHLY_PRICE_CENTS', 999);
    const premiumAnnualPrice = this.config.get<number>('PREMIUM_ANNUAL_PRICE_CENTS', 9990);

    const plans: PlanSeedRecord[] = [
      {
        id: 'free',
        version: 1,
        displayName: 'Free',
        amountCents: 0,
        currency: 'USD',
        intervalDays: null,
        features: ['basic_notes'],
        isActive: true,
      },
      {
        id: 'premium_monthly',
        version: 1,
        displayName: 'Premium Monthly',
        amountCents: premiumMonthlyPrice,
        currency: 'USD',
        intervalDays: 30,
        features: ['premium_notes'],
        isActive: true,
      },
      {
        id: 'premium_annual',
        version: 1,
        displayName: 'Premium Annual',
        amountCents: premiumAnnualPrice,
        currency: 'USD',
        intervalDays: 365,
        features: ['premium_notes'],
        isActive: true,
      },
    ];

    for (const plan of plans) {
      await this.prisma.plan.upsert({
        where: { id: plan.id },
        create: plan,
        update: { amountCents: plan.amountCents, isActive: plan.isActive },
      });
    }

    this.logger.log(`Plan catalog seeded: ${plans.map((p) => p.id).join(', ')}`);
  }
}
