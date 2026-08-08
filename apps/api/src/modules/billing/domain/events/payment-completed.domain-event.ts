import { uuidv7 } from 'uuidv7';
import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export class PaymentCompletedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'PaymentCompleted' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly paymentId: string,
    public readonly billingEntityId: string,
    public readonly planId: string,
    public readonly planVersion: number,
    public readonly correlationId: string,
  ) {
    this.eventId = uuidv7();
    this.aggregateId = paymentId;
    this.occurredOn = new Date();
  }
}
