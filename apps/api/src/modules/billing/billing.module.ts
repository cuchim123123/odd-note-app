import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { ConfigModule } from '@config/config.module';

// ─── Application: Ports ───────────────────────────────────────────────────────
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { PLAN_CATALOG_REPOSITORY } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import { ENTITLEMENT_QUERY_DAO } from '@modules/billing/application/ports/dao/entitlement-query.dao.port';
import { BILLING_INTEGRATION_EVENT_MAPPER } from '@modules/billing/application/mappers/billing-integration-event.mapper';

// ─── Application: Domain Services ────────────────────────────────────────────
import { PricingService } from '@modules/billing/domain/services/pricing.service';

// ─── Application: Mappers ─────────────────────────────────────────────────────
import { BillingDefaultIntegrationEventMapper } from '@modules/billing/application/mappers/billing-integration-event.mapper';

// ─── Infrastructure: Adapters ─────────────────────────────────────────────────
import { PrismaBillingUnitOfWork } from '@modules/billing/infrastructure/persistence/transactions/prisma-billing-unit-of-work';
import { PrismaPlanCatalogRepository } from '@modules/billing/infrastructure/persistence/prisma-plan-catalog.repository';
import { PrismaEntitlementQueryDao } from '@modules/billing/infrastructure/persistence/dao/prisma-entitlement-query.dao';
import { PlanCatalogSeeder } from '@modules/billing/infrastructure/seeders/plan-catalog.seeder';

// TODO Phase 2: Add command handlers
// TODO Phase 3: Add webhook handler, gateway adapter
// TODO Phase 4: Add entitlement query handler, controllers

@Module({
  imports: [CqrsModule, PrismaModule, RedisModule, ConfigModule],
  providers: [
    // ── Domain Services ────────────────────────────────────────────────────
    PricingService,

    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: BILLING_UNIT_OF_WORK, useClass: PrismaBillingUnitOfWork },
    { provide: PLAN_CATALOG_REPOSITORY, useClass: PrismaPlanCatalogRepository },
    { provide: BILLING_INTEGRATION_EVENT_MAPPER, useClass: BillingDefaultIntegrationEventMapper },
    { provide: ENTITLEMENT_QUERY_DAO, useClass: PrismaEntitlementQueryDao },

    // ── Infrastructure ────────────────────────────────────────────────────
    PlanCatalogSeeder,
  ],
  exports: [
    // Exported for cross-module entitlement checks (Notes, Collaboration, etc.)
    ENTITLEMENT_QUERY_DAO,
  ],
})
export class BillingModule {}
