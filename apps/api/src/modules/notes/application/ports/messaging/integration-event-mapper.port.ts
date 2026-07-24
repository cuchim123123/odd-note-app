import type { NoteSharedIntegrationEvent } from '@modules/notes/application/integration-events/note-shared.integration-event';
import type { OutboxMessageDraft } from '@modules/notes/application/mappers/integration-event.mapper';

export const NOTE_INTEGRATION_EVENT_MAPPER = Symbol('NOTE_INTEGRATION_EVENT_MAPPER');

export interface INoteIntegrationEventMapper {
  serialize(topic: string, payload: NoteSharedIntegrationEvent): OutboxMessageDraft;
}
