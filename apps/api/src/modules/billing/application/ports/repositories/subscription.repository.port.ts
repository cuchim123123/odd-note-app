import type { Subscription } from '@modules/billing/domain/aggregates/subscription.aggregate';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

export interface ISubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findByBillingEntityId(billingEntityId: string): Promise<Subscription | null>;
  findByPaymentId(paymentId: string): Promise<Subscription | null>;
  /** Used by recurring webhook handler. FOR UPDATE applied by implementation. */
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;
}
