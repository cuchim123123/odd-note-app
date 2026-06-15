import type { DomainEvent } from '../../../common/ddd/domain-event';

export class NoteShareRevokedDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly shareId: string,
  ) {
    this.occurredOn = new Date();
  }
}
