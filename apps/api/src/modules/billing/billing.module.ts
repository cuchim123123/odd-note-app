import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { ConfigModule } from '@config/config.module';
import type { EnvConfig } from '@config/config.module';

// ─── Application: Ports ───────────────────────────────────────────────────────
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { PLAN_CATALOG_REPOSITORY } from '@modules/billing/application/ports/repositories/plan-catalog.repository.port';
import { ENTITLEMENT_QUERY_DAO } from '@modules/billing/application/ports/dao/entitlement-query.dao.port';
import { PAYMENT_GATEWAY } from '@modules/billing/application/ports/payment-gateway.port';
import { BILLING_INTEGRATION_EVENT_MAPPER } from '@modules/billing/application/mappers/billing-integration-event.mapper';

// ─── Application: Domain Services ────────────────────────────────────────────
import { PricingService } from '@modules/billing/domain/services/pricing.service';

// ─── Application: Command Handlers ───────────────────────────────────────────
import { InitiatePaymentHandler } from '@modules/billing/application/commands/initiate-payment/initiate-payment.handler';
import { HandlePaymentSucceededHandler } from '@modules/billing/application/commands/handle-payment-succeeded/handle-payment-succeeded.handler';
import { HandlePaymentFailedHandler } from '@modules/billing/application/commands/handle-payment-failed/handle-payment-failed.handler';
import { HandleSubscriptionRenewedHandler } from '@modules/billing/application/commands/handle-subscription-renewed/handle-subscription-renewed.handler';
import { HandleSubscriptionPaymentFailedHandler } from '@modules/billing/application/commands/handle-subscription-payment-failed/handle-subscription-payment-failed.handler';
import { HandleSubscriptionCancelledHandler } from '@modules/billing/application/commands/handle-subscription-cancelled/handle-subscription-cancelled.handler';
import { AssignFreeEntitlementHandler } from '@modules/billing/application/commands/assign-free-entitlement/assign-free-entitlement.handler';

// ─── Application: Mappers ─────────────────────────────────────────────────────
import { BillingDefaultIntegrationEventMapper } from '@modules/billing/application/mappers/billing-integration-event.mapper';

// ─── Infrastructure: Adapters ─────────────────────────────────────────────────
import { PrismaBillingUnitOfWork } from '@modules/billing/infrastructure/persistence/transactions/prisma-billing-unit-of-work';
import { PrismaPlanCatalogRepository } from '@modules/billing/infrastructure/persistence/prisma-plan-catalog.repository';
import { PrismaEntitlementQueryDao } from '@modules/billing/infrastructure/persistence/dao/prisma-entitlement-query.dao';
import { MockPaymentGatewayAdapter } from '@modules/billing/infrastructure/gateways/mock-payment-gateway.adapter';
import { StripePaymentGatewayAdapter } from '@modules/billing/infrastructure/gateways/stripe-payment-gateway.adapter';
import { PlanCatalogSeeder } from '@modules/billing/infrastructure/seeders/plan-catalog.seeder';
import { PaymentReconciliationJob } from '@modules/billing/infrastructure/jobs/payment-reconciliation.job';

// ─── Presentation: HTTP Controllers ──────────────────────────────────────────
import { InitiatePaymentHttpController } from '@modules/billing/presentation/http/commands/initiate-payment/initiate-payment.http.controller';
import { StripeWebhookHttpController } from '@modules/billing/presentation/http/webhooks/stripe-webhook.http.controller';
import { GetEntitlementHttpController } from '@modules/billing/presentation/http/queries/get-entitlement/get-entitlement.http.controller';

// ─── Presentation: Kafka Consumers ───────────────────────────────────────────
import { UserRegisteredConsumer } from '@modules/billing/presentation/kafka/user-registered.consumer';

// TODO Phase 4: EntitlementQueryDao cross-module wiring

@Module({
  imports: [CqrsModule, PrismaModule, RedisModule, ConfigModule],
  controllers: [
    InitiatePaymentHttpController,
    StripeWebhookHttpController,
    GetEntitlementHttpController,
    UserRegisteredConsumer,
  ],
  providers: [
    // ── Domain Services ────────────────────────────────────────────────────
    PricingService,

    // ── Application: Command Handlers ─────────────────────────────────────
    InitiatePaymentHandler,
    HandlePaymentSucceededHandler,
    HandlePaymentFailedHandler,
    HandleSubscriptionRenewedHandler,
    HandleSubscriptionPaymentFailedHandler,
    HandleSubscriptionCancelledHandler,
    AssignFreeEntitlementHandler,

    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: BILLING_UNIT_OF_WORK, useClass: PrismaBillingUnitOfWork },
    { provide: PLAN_CATALOG_REPOSITORY, useClass: PrismaPlanCatalogRepository },
    { provide: BILLING_INTEGRATION_EVENT_MAPPER, useClass: BillingDefaultIntegrationEventMapper },
    { provide: ENTITLEMENT_QUERY_DAO, useClass: PrismaEntitlementQueryDao },
    { 
      provide: PAYMENT_GATEWAY,
      useFactory: (config: EnvConfig) => {
        return config.STRIPE_SECRET_KEY
          ? new StripePaymentGatewayAdapter(config)
          : new MockPaymentGatewayAdapter();
      },
      inject: ['ENV_CONFIG'],
    },

    // ── Infrastructure ────────────────────────────────────────────────────
    PlanCatalogSeeder,
    PaymentReconciliationJob,
  ],
  exports: [
    // Exported for cross-module entitlement checks (Notes, Collaboration, etc.)
    ENTITLEMENT_QUERY_DAO,
  ],
})
export class BillingModule {}

