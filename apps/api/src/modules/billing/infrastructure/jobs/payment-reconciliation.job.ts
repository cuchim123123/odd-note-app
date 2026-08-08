import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PAYMENT_GATEWAY } from '@modules/billing/application/ports/payment-gateway.port';
import type { IPaymentGatewayPort } from '@modules/billing/application/ports/payment-gateway.port';


/**
 * PaymentReconciliationJob — runs every 15 minutes.
 *
 * Problem: Webhooks can be missed (network blip, Stripe outage, deployment restart).
 * A payment may be PENDING in our DB but COMPLETED at Stripe.
 * This job catches those orphaned payments.
 *
 * Strategy:
 *   1. Query all PENDING payments older than 5 minutes (giving webhooks time to arrive)
 *   2. For each, query the provider to get the current status
 *   3. If the provider says COMPLETED — fire HandlePaymentSucceededCommand
 *   4. If the provider says FAILED — fire HandlePaymentFailedCommand
 *   5. If older than 24h and still PENDING — mark as FAILED (provider timeout)
 *
 * NOTE: This job intentionally dispatches the same commands as the webhook controller
 * so that idempotency (ProcessedWebhookEvent table) handles duplicates transparently.
 *
 * TODO (Phase 6 Stripe): Implement actual Stripe session status query in
 * StripePaymentGatewayAdapter.getSessionStatus() and wire it here.
 */
@Injectable()
export class PaymentReconciliationJob {
  private readonly logger = new Logger(PaymentReconciliationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: IPaymentGatewayPort,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPayments(): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const timeoutCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const stuckPayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        externalId: true,
        provider: true,
        createdAt: true,
      },
      take: 100, // Process in batches to avoid memory spikes
    });

    if (stuckPayments.length === 0) return;

    this.logger.log(`[Reconciliation] Found ${stuckPayments.length} stuck PENDING payments`);

    for (const payment of stuckPayments) {
      if (!payment.externalId || !payment.provider) continue;

      // Timeout: 24h PENDING is definitively stuck — mark as FAILED without provider query
      if (payment.createdAt < timeoutCutoff) {
        this.logger.warn(
          `[Reconciliation] Payment ${payment.id} timed out after 24h — marking FAILED`,
        );
        // TODO: dispatch HandlePaymentFailedCommand with reason='reconciliation_timeout'
        continue;
      }

      // TODO (Phase 6): Query gateway.getSessionStatus(payment.externalId)
      // and dispatch HandlePaymentSucceededCommand or HandlePaymentFailedCommand
      this.logger.debug(
        `[Reconciliation] Payment ${payment.id} (${payment.provider}:${payment.externalId}) is stuck — provider check pending implementation`,
      );
    }
  }
}
