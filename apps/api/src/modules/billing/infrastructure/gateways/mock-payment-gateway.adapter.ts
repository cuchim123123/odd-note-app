import { Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { IPaymentGatewayPort, CreateCheckoutSessionDto, CheckoutSessionResult, VerifiedWebhookEvent } from '@modules/billing/application/ports/payment-gateway.port';
import { ProviderReference } from '@modules/billing/domain/value-objects/provider-reference.vo';

/**
 * MockPaymentGatewayAdapter — local development / CI gateway.
 * Activated when PAYMENT_GATEWAY=mock (default in non-production environments).
 * 
 * Returns a deterministic checkoutUrl pointing to a local mock endpoint.
 * parseWebhookEvent accepts a JSON body with { type, externalId } directly —
 * no signature verification is performed in mock mode.
 *
 * Swapping to StripePaymentGatewayAdapter requires zero changes outside this file.
 */
@Injectable()
export class MockPaymentGatewayAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(MockPaymentGatewayAdapter.name);

  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResult> {
    const externalId = `mock_session_${uuidv7()}`;
    const checkoutUrl = `http://localhost:3000/billing/mock-checkout/${externalId}`;

    this.logger.log(
      `[Mock] Created checkout session ${externalId} for billingEntityId=${dto.billingEntityId} plan=${dto.planId}`,
    );

    return {
      providerRef: ProviderReference.of('mock', externalId),
      checkoutUrl,
    };
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): VerifiedWebhookEvent {
    void signature; // Mock mode: no signature verification performed
    const payload = JSON.parse(rawBody.toString()) as {
      webhookEventId?: string;
      type: string;
      externalId: string;
      stripeSubscriptionId?: string;
      failureReason?: string;
      metadata?: Record<string, string>;
    };

    this.logger.log(`[Mock] Received webhook event type=${payload.type} externalId=${payload.externalId}`);

    return {
      webhookEventId: payload.webhookEventId ?? `mock_evt_${uuidv7()}`,
      type: payload.type as VerifiedWebhookEvent['type'],
      externalId: payload.externalId,
      stripeSubscriptionId: payload.stripeSubscriptionId ?? null,
      failureReason: payload.failureReason ?? null,
      metadata: payload.metadata ?? {},
    };
  }

  async getSessionStatus(externalId: string): Promise<'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'> {
    this.logger.debug(`[Mock] getSessionStatus called for ${externalId} — returning PENDING`);
    // By default, the mock just returns PENDING so reconciliation skips it
    // In advanced mock testing, you could make it return based on memory state or externalId prefix
    return 'PENDING';
  }
}
