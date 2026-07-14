import * as crypto from 'crypto';
import type { DomainEvent } from '../../../../shared/domain/ddd/domain-event';

export class NoteCreatedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'NoteCreated' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly title: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = noteId;
    this.occurredOn = new Date();
  }
}
