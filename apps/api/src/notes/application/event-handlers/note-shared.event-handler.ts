import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NoteSharedDomainEvent } from '../../domain/events/note-shared.domain-event';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '../ports/note-outbox.port';
import type { NoteSharedIntegrationEvent } from '../integration-events/note-shared.integration-event';

/**
 * NoteSharedEventHandler
 *
 * Responsibility:
 *  - Listens to the in-process NoteSharedDomainEvent (emitted by ShareNoteHandler)
 *  - Maps it to the public NoteSharedIntegrationEvent contract
 *  - Schedules it via the Outbox port for reliable Kafka delivery
 *
 * This separates the messaging concern from the command handler,
 * enabling future consumers (analytics, CRM, credits, etc.)
 * to be added without modifying the domain command.
 */
@EventsHandler(NoteSharedDomainEvent)
export class NoteSharedEventHandler implements IEventHandler<NoteSharedDomainEvent> {
  constructor(
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outbox: INoteOutboxPort,
  ) {}

  async handle(event: NoteSharedDomainEvent): Promise<void> {
    const integrationEvent: NoteSharedIntegrationEvent = {
      eventId: event.eventId,
      occurredOn: event.occurredOn.toISOString(),
      noteId: event.noteId,
      shareId: event.shareId,
      ownerId: event.ownerId,
      recipientId: event.recipientId,
      recipientEmail: event.recipientEmail,
      permission: event.permission,
      noteTitle: '', // Domain event does not carry note title — acceptable trade-off
    };

    await this.outbox.scheduleIntegrationEvent(
      'NoteShared',
      integrationEvent as unknown as Record<string, unknown>,
    );
  }
}
