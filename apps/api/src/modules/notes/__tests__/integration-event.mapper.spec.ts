import { describe, expect, it } from 'vitest';
import { DefaultNoteIntegrationEventMapper } from '@modules/notes/application/mappers/integration-event.mapper';
import { NoteSharedDomainEvent } from '@modules/notes/domain/events/note-shared.domain-event';
import { NoteId, UserId } from '@shared/domain/ddd/id-types';

// Mock unmapped event
class UnmappedDomainEvent {
  public readonly eventType = 'UnmappedEvent';
  public readonly eventId = 'event-1';
  public readonly aggregateId = 'agg-1';
  public readonly occurredOn = new Date();
}

describe('DefaultNoteIntegrationEventMapper', () => {
  const mapper = new DefaultNoteIntegrationEventMapper();

  it('maps NoteSharedDomainEvent correctly', () => {
    const event = new NoteSharedDomainEvent(
      NoteId.from('note-1'),
      UserId.from('owner-1'),
      UserId.from('recipient-1'),
      'READ',
      'share-1',
    );

    const outboxMessages = mapper.map([event as any]);

    expect(outboxMessages).toHaveLength(1);
    expect(outboxMessages[0]?.topic).toBe('NoteShared');
    expect(outboxMessages[0]?.type).toBe('INTEGRATION_EVENT');
    expect(outboxMessages[0]?.payload).toMatchObject({
      eventId: event.eventId,
      aggregateId: 'note-1',
      eventType: 'NoteShared',
      payload: {
        shareId: 'share-1',
        ownerId: 'owner-1',
        recipientId: 'recipient-1',
        permission: 'READ',
      },
    });
  });

  it('throws error for unmapped domain events', () => {
    const event = new UnmappedDomainEvent();

    expect(() => mapper.map([event as any])).toThrowError(
      "Integration Event Mapper: No translator found for domain event type 'UnmappedEvent'."
    );
  });
});
