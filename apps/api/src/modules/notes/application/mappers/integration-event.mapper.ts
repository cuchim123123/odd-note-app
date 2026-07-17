import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import { NoteSharedDomainEvent } from '@modules/notes/domain/events/note-shared.domain-event';
import type { NoteSharedIntegrationEvent } from '@modules/notes/application/integration-events/note-shared.integration-event';

export type OutboxMessageDraft = {
  topic: string;
  payload: Record<string, unknown>;
};

export interface NoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[];
}

type DomainEventMapper = (event: DomainEvent) => OutboxMessageDraft;

export class DefaultNoteIntegrationEventMapper implements NoteIntegrationEventMapper {
  private readonly mappers = new Map<string, DomainEventMapper>();

  constructor() {
    this.registerMappers();
  }

  private registerMappers(): void {
    this.mappers.set('NoteShared', (e: DomainEvent) => {
      const event = e as NoteSharedDomainEvent;
      const payload: NoteSharedIntegrationEvent = {
        eventId: event.eventId,
        occurredOn: event.occurredOn.toISOString(),
        noteId: event.noteId,
        shareId: event.shareId,
        ownerId: event.ownerId,
        recipientId: event.recipientId,
        recipientEmail: '', // Domain event does not carry email, this should ideally be populated
        permission: event.permission,
        noteTitle: '', // Domain event does not carry note title
      };

      return {
        topic: 'NoteShared',
        payload: payload as unknown as Record<string, unknown>,
      };
    });
    // Additional event mappers can be registered here in the future
    // without modifying the core map() loop.
  }

  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      const mapper = this.mappers.get(event.eventType);
      if (mapper) {
        outboxMessages.push(mapper(event));
      }
    }

    return outboxMessages;
  }
}
