import { uuidv7 } from 'uuidv7';
import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export class NoteDeletedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'NoteDeleted' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
  ) {
    this.eventId = uuidv7();
    this.aggregateId = noteId;
    this.occurredOn = new Date();
  }
}
