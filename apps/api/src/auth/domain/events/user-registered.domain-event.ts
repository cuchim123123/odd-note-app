import * as crypto from 'crypto';
import type { DomainEvent } from '../../../common/ddd/domain-event';

export class UserRegisteredDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'UserRegistered' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = userId;
    this.occurredOn = new Date();
  }
}
