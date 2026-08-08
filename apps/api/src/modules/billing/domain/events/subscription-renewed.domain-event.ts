import { uuidv7 } from 'uuidv7';
import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export class SubscriptionRenewedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'SubscriptionRenewed' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly subscriptionId: string,
    public readonly billingEntityId: string,
    public readonly planId: string,
    public readonly newPeriodEnd: Date,
    public readonly correlationId: string,
  ) {
    this.eventId = uuidv7();
    this.aggregateId = subscriptionId;
    this.occurredOn = new Date();
  }
}
