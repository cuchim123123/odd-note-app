import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PAYMENT_GATEWAY } from '@modules/billing/application/ports/payment-gateway.port';
import type { IPaymentGatewayPort } from '@modules/billing/application/ports/payment-gateway.port';

import { CommandBus } from '@nestjs/cqrs';
import { HandlePaymentFailedCommand } from '@modules/billing/application/commands/handle-payment-failed/handle-payment-failed.command';
import { HandlePaymentSucceededCommand } from '@modules/billing/application/commands/handle-payment-succeeded/handle-payment-succeeded.command';
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
    private readonly commandBus: CommandBus,
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
        const reconciliationEventId = `recon_timeout_${payment.id}`;
        await this.commandBus.execute(
          new HandlePaymentFailedCommand(
            reconciliationEventId,
            payment.externalId,
            payment.provider,
            'reconciliation_timeout',
            reconciliationEventId,
          ),
        );
        continue;
      }

      try {
        const status = await this.gateway.getSessionStatus(payment.externalId);
        
        if (status === 'COMPLETED') {
          this.logger.log(`[Reconciliation] Payment ${payment.id} is COMPLETED at provider — reconciling`);
          const reconEventId = `recon_success_${payment.id}`;
          await this.commandBus.execute(
            new HandlePaymentSucceededCommand(
              reconEventId,
              payment.externalId,
              payment.provider,
              reconEventId, // correlationId
            ),
          );
        } else if (status === 'FAILED' || status === 'EXPIRED') {
          this.logger.log(`[Reconciliation] Payment ${payment.id} is ${status} at provider — reconciling`);
          const reconEventId = `recon_fail_${payment.id}`;
          await this.commandBus.execute(
            new HandlePaymentFailedCommand(
              reconEventId,
              payment.externalId,
              payment.provider,
              `reconciliation_${status.toLowerCase()}`,
              reconEventId, // correlationId
            ),
          );
        } else {
          this.logger.debug(`[Reconciliation] Payment ${payment.id} is still PENDING at provider — skipping`);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        this.logger.error(`[Reconciliation] Failed to check status for payment ${payment.id}: ${err.message}`);
      }
    }
  }
}
