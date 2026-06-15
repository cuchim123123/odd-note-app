import type { DomainEvent } from '../../../common/ddd/domain-event';

export class NoteShareUpdatedDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly recipientId: string,
    public readonly permission: string,
    public readonly shareId: string,
  ) {
    this.occurredOn = new Date();
  }
}
