import type { Payment } from '@modules/billing/domain/aggregates/payment.aggregate';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface IPaymentRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  /** Used by webhook handler. FOR UPDATE must be applied by the implementation. */
  findByExternalId(externalId: string): Promise<Payment | null>;
  findByBillingEntityAndIdempotencyKey(
    billingEntityId: string,
    idempotencyKey: string,
  ): Promise<Payment | null>;
}
