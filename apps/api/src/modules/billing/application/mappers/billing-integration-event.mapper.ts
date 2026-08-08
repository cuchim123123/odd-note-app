import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import type { IDomainEventMapper, OutboxMessageDraft } from '@shared/application/ports/domain-event-mapper.port';
import { PaymentCompletedDomainEvent } from '@modules/billing/domain/events/payment-completed.domain-event';
import { PaymentFailedDomainEvent } from '@modules/billing/domain/events/payment-failed.domain-event';
import { SubscriptionActivatedDomainEvent } from '@modules/billing/domain/events/subscription-activated.domain-event';
import { SubscriptionRenewedDomainEvent } from '@modules/billing/domain/events/subscription-renewed.domain-event';
import { SubscriptionPaymentFailedDomainEvent } from '@modules/billing/domain/events/subscription-payment-failed.domain-event';
import { SubscriptionCancelledDomainEvent } from '@modules/billing/domain/events/subscription-cancelled.domain-event';

export const BILLING_INTEGRATION_EVENT_MAPPER = Symbol('BILLING_INTEGRATION_EVENT_MAPPER');
export type BillingIntegrationEventMapper = IDomainEventMapper;

/**
 * Maps billing domain events to Outbox message drafts.
 *
 * Every integration event carries:
 *   - schemaVersion: for consumer compatibility
 *   - correlationId + eventId: for distributed tracing and idempotent consumers
 *   - partitionKey: billingEntityId — ensures ordering per entity on Kafka
 *
 * NOTE: PaymentInitiated and PaymentCancelled intentionally produce NO outbox messages
 * (analytics events can be added here later as a separate topic).
 */
export class BillingDefaultIntegrationEventMapper implements BillingIntegrationEventMapper {
  map(events: DomainEvent[]): OutboxMessageDraft[] {
    const drafts: OutboxMessageDraft[] = [];

    for (const event of events) {
      if (event instanceof PaymentCompletedDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.payment.succeeded',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            paymentId: event.paymentId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            planVersion: event.planVersion,
            occurredOn: event.occurredOn.toISOString(),
            // NOTE: amount/currency intentionally omitted — other BCs don't need financial data
          },
        });
      }

      if (event instanceof PaymentFailedDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.payment.failed',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            paymentId: event.paymentId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            reason: event.reason,
            occurredOn: event.occurredOn.toISOString(),
          },
        });
      }

      if (event instanceof SubscriptionActivatedDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.subscription.activated',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            subscriptionId: event.subscriptionId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            planVersion: event.planVersion,
            features: event.features,
            expiresAt: event.currentPeriodEnd?.toISOString() ?? null,
            occurredOn: event.occurredOn.toISOString(),
          },
        });
      }

      if (event instanceof SubscriptionRenewedDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.subscription.renewed',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            subscriptionId: event.subscriptionId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            newPeriodEnd: event.newPeriodEnd.toISOString(),
            occurredOn: event.occurredOn.toISOString(),
          },
        });
      }

      if (event instanceof SubscriptionPaymentFailedDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.subscription.payment_failed',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            subscriptionId: event.subscriptionId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            occurredOn: event.occurredOn.toISOString(),
          },
        });
      }

      if (event instanceof SubscriptionCancelledDomainEvent) {
        drafts.push({
          type: 'INTEGRATION_EVENT',
          topic: 'billing.subscription.cancelled',
          payload: {
            schemaVersion: 1,
            eventId: event.eventId,
            correlationId: event.correlationId,
            causationId: event.aggregateId,
            subscriptionId: event.subscriptionId,
            billingEntityId: event.billingEntityId,
            planId: event.planId,
            occurredOn: event.occurredOn.toISOString(),
          },
        });
      }
    }

    return drafts;
  }
}
