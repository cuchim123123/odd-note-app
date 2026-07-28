import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import type { IDomainEventMapper, OutboxMessageDraft } from '@shared/application/ports/domain-event-mapper.port';
import { NoteSharedDomainEvent } from '@modules/notes/domain/events/note-shared.domain-event';
import { NoteCreatedDomainEvent } from '@modules/notes/domain/events/note-created.domain-event';
import { NoteDeletedDomainEvent } from '@modules/notes/domain/events/note-deleted.domain-event';

export type NoteIntegrationEventMapper = IDomainEventMapper;

export class DefaultNoteIntegrationEventMapper implements NoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      if (event instanceof NoteSharedDomainEvent) {
        outboxMessages.push({
          type: 'INTEGRATION_EVENT',
          topic: 'NoteShared',
          payload: {
            eventId: event.eventId,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredOn,
            
            shareId: event.shareId,
            ownerId: event.ownerId,
            recipientId: event.recipientId,
            permission: event.permission,
          },
        });
      } else if (event instanceof NoteCreatedDomainEvent) {
        outboxMessages.push({
          type: 'INTEGRATION_EVENT',
          topic: 'NoteCreated',
          payload: {
            eventId: event.eventId,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredOn,
            
            ownerId: event.ownerId,
            title: event.title,
          },
        });
      } else if (event instanceof NoteDeletedDomainEvent) {
        outboxMessages.push({
          type: 'INTEGRATION_EVENT',
          topic: 'NoteDeleted',
          payload: {
            eventId: event.eventId,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredOn,
          },
        });
      }
      // Add more domain event mappings (LabelRenamed, ProtectionSet, etc.)
    }

    return outboxMessages;
  }
}
