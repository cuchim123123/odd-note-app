import type { DomainEvent } from '../../../common/ddd/domain-event';
import { NoteSharedDomainEvent } from '../../domain/events/note-shared.domain-event';

export type OutboxMessageDraft = {
  topic: string;
  payload: Record<string, unknown>;
};

export interface NoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[];
}

export class DefaultNoteIntegrationEventMapper implements NoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      if (event instanceof NoteSharedDomainEvent) {
        outboxMessages.push({
          topic: 'NoteShared',
          payload: {
            eventId: event.eventId,
            occurredOn: event.occurredOn.toISOString(),
            noteId: event.noteId,
            shareId: event.shareId,
            ownerId: event.ownerId,
            recipientId: event.recipientId,
            recipientEmail: event.recipientEmail,
            permission: event.permission,
            noteTitle: '', // Domain event does not carry note title
          },
        });
      }
      // Map more events here if needed
    }

    return outboxMessages;
  }
}
