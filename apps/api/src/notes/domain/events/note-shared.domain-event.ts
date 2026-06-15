import type { DomainEvent } from '../../../common/ddd/domain-event';


export class NoteSharedDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly recipientId: string,
    public readonly recipientEmail: string,
    public readonly permission: string, // string representation of SharePermission
    public readonly shareId: string,
  ) {
    this.occurredOn = new Date();
  }
}
