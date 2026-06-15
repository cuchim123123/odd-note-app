import type { DomainEvent } from '../../../common/ddd/domain-event';

export class NoteDeletedDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
  ) {
    this.occurredOn = new Date();
  }
}
