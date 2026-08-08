import type { Money } from '@modules/billing/domain/value-objects/money.vo';
import type { ProviderReference } from '@modules/billing/domain/value-objects/provider-reference.vo';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateCheckoutSessionDto {
  billingEntityId: string;
  planId: string;
  planVersion: number;
  quote: Money;
  idempotencyKey: string;
  correlationId: string;
  /** Provider-neutral metadata forwarded to the gateway for webhook reconciliation */
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  providerRef: ProviderReference;
  checkoutUrl: string;
}

/**
 * Provider-neutral event emitted by the webhook ACL adapter.
 * The Stripe adapter translates Stripe-specific events into this type.
 * The application layer never references Stripe SDK types.
 */
export type WebhookEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'payment.requires_action'
  | 'subscription.renewed'
  | 'subscription.payment_failed'
  | 'subscription.cancelled';

export interface VerifiedWebhookEvent {
  webhookEventId: string;
  type: WebhookEventType;
  /** externalId of the payment/subscription in provider's system */
  externalId: string;
  /** stripeSubscriptionId for recurring events — null for one-time */
  stripeSubscriptionId: string | null;
  /** Provider-neutral failure reason */
  failureReason: string | null;
  /** Metadata attached when creating the session */
  metadata: Record<string, string>;
}

export interface IPaymentGatewayPort {
  /**
   * Creates a hosted checkout session at the provider.
   * Returns a redirect URL and a provider reference.
   */
  createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResult>;

  /**
   * Anti-Corruption Layer: verifies and translates a raw webhook payload
   * into a provider-neutral VerifiedWebhookEvent.
   * Throws if signature is invalid.
   */
  parseWebhookEvent(rawBody: Buffer, signature: string): VerifiedWebhookEvent;
}
