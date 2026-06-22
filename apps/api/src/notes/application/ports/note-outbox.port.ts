export const NOTE_OUTBOX_PORT = Symbol('NoteOutboxPort');

export interface INoteOutboxPort {
  scheduleIntegrationEvent(topic: string, payload: Record<string, unknown>): Promise<void>;
}
