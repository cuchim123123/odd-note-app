import type { NoteSharedIntegrationEvent } from '@modules/notes/application/integration-events/note-shared.integration-event';

export type OutboxMessageDraft = {
  topic: string;
  payload: Record<string, unknown>;
};

export interface NoteIntegrationEventMapper {
  serialize(topic: string, payload: NoteSharedIntegrationEvent): OutboxMessageDraft;
}

export class DefaultNoteIntegrationEventMapper implements NoteIntegrationEventMapper {
  serialize(topic: string, payload: NoteSharedIntegrationEvent): OutboxMessageDraft {
    return {
      topic,
      payload: payload as unknown as Record<string, unknown>,
    };
  }
}
