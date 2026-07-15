import * as crypto from 'crypto';
import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export class NoteShareRevokedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly eventType = 'NoteShareRevoked' as const;
  public readonly occurredOn: Date;

  constructor(
    public readonly noteId: string,
    public readonly ownerId: string,
    public readonly shareId: string,
  ) {
    this.eventId = crypto.randomUUID();
    this.aggregateId = noteId;
    this.occurredOn = new Date();
  }
}
