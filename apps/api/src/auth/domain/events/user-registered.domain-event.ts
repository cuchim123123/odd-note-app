import type { DomainEvent } from '../shared/domain-event';

export class UserRegisteredDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {
    this.occurredOn = new Date();
  }
}
