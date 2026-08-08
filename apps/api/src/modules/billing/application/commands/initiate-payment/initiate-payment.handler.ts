import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException } from '@nestjs/common';
import { InitiatePaymentCommand } from '@modules/billing/application/commands/initiate-payment/initiate-payment.command';
import { BILLING_UNIT_OF_WORK } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import type { IBillingUnitOfWork } from '@modules/billing/application/ports/transactions/billing-unit-of-work.port';
import { PAYMENT_GATEWAY } from '@modules/billing/application/ports/payment-gateway.port';
import type { IPaymentGatewayPort } from '@modules/billing/application/ports/payment-gateway.port';
import { PricingService } from '@modules/billing/domain/services/pricing.service';
import { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';
import { PlanVersion } from '@modules/billing/domain/value-objects/plan-version.vo';
import { Payment } from '@modules/billing/domain/aggregates/payment.aggregate';

export interface InitiatePaymentResult {
  paymentId: string;
  checkoutUrl: string;
}

@CommandHandler(InitiatePaymentCommand)
export class InitiatePaymentHandler implements ICommandHandler<InitiatePaymentCommand> {
  private readonly logger = new Logger(InitiatePaymentHandler.name);

  constructor(
    @Inject(BILLING_UNIT_OF_WORK) private readonly uow: IBillingUnitOfWork,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: IPaymentGatewayPort,
    private readonly pricingService: PricingService,
  ) {}

  async execute(command: InitiatePaymentCommand): Promise<InitiatePaymentResult> {
    const { userId, planId, idempotencyKey, correlationId } = command;
    const billingEntityId = BillingEntityId.fromUser(userId);

    // 1. Idempotency check — return existing pending payment if key already used
    const existing = await this.uow.execute(async ({ repos }) => {
      return repos.payment.findByBillingEntityAndIdempotencyKey(billingEntityId, idempotencyKey);
    });

    if (existing) {
      if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED' || existing.status === 'FAILED') {
        throw new BadRequestException(
          `Idempotency key '${idempotencyKey}' was already used for a ${existing.status} payment. Use a new key for a fresh payment attempt.`,
        );
      }
      this.logger.log(`Returning existing PENDING payment ${existing.id} for idempotencyKey=${idempotencyKey}`);
      // We need the checkoutUrl — it's stored on the providerRef
      const checkoutUrl = existing.providerRef
        ? `existing_session:${existing.providerRef.externalId}` // real Stripe: reconstruct URL from session
        : '';
      return { paymentId: existing.id, checkoutUrl };
    }

    // 2. Resolve price server-side — client never supplies amount
    const { plan, quote } = await this.pricingService.getQuote(planId);

    // 3. Create provider checkout session (outside transaction — external call)
    const { providerRef, checkoutUrl } = await this.gateway.createCheckoutSession({
      billingEntityId,
      planId,
      planVersion: plan.version,
      quote,
      idempotencyKey,
      correlationId,
      metadata: {
        billingEntityId,
        planId,
        planVersion: String(plan.version),
        correlationId,
      },
    });

    // 4. Persist Payment aggregate in a transaction
    let paymentId!: string;
    await this.uow.execute(async ({ repos }) => {
      const payment = Payment.initiate({
        billingEntityId,
        planVersion: PlanVersion.of(plan.id, plan.version),
        quote,
        providerRef,
        correlationId,
        idempotencyKey,
      });

      await repos.payment.save(payment);
      paymentId = payment.id;
    });

    this.logger.log(`Payment ${paymentId} initiated for billingEntityId=${billingEntityId} plan=${planId}`);

    return { paymentId, checkoutUrl };
  }
}
