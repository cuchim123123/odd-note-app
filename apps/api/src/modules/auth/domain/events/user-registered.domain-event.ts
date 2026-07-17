import { uuidv7 } from 'uuidv7';
import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export class UserRegisteredDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'UserRegistered' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    this.eventId = uuidv7();
    this.aggregateId = userId;
    this.occurredOn = new Date();
  }
}
