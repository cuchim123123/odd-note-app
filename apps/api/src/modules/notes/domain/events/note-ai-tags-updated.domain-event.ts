import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import { uuidv7 } from 'uuidv7';

export class NoteAITagsUpdatedDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'NoteAITagsUpdated';
  public readonly occurredOn: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly ownerId: string,
    public readonly aiTags: string[],
    public readonly snapshotSeq: string,
  ) {
    this.eventId = uuidv7();
    this.occurredOn = new Date();
  }
}
