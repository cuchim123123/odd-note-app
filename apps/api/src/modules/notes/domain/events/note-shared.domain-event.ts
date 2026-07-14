import * as crypto from 'crypto';
import type { DomainEvent } from '../../../../common/domain/domain-event';

export class NoteSharedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'NoteShared' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly recipientId: string,
    public readonly recipientEmail: string,
    public readonly permission: string,
    public readonly shareId: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = noteId;
    this.occurredOn = new Date();
  }
}
