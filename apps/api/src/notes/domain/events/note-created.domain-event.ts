import type { DomainEvent } from '../../../common/ddd/domain-event';

export class NoteCreatedDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly title: string,
  ) {
    this.occurredOn = new Date();
  }
}
