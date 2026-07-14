import * as crypto from 'crypto';
import type { DomainEvent } from '../../../../common/domain/domain-event';

export class NotePasswordRemovedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'NotePasswordRemoved' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = noteId;
    this.occurredOn = new Date();
  }
}
