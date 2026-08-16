import { Injectable, Logger, Inject } from '@nestjs/common';
import { type IInternalCommandHandler } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { NOTE_SEARCH_INDEX_PORT } from '@modules/notes/application/ports/external/note-search-index.port';
import type { INoteSearchIndexPort } from '@modules/notes/application/ports/external/note-search-index.port';

interface IndexNoteBodyPayload {
  noteId: string;
  plainText: string;
}

@Injectable()
export class NoteBodyIndexInternalHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(NoteBodyIndexInternalHandler.name);

  constructor(
    @Inject(NOTE_SEARCH_INDEX_PORT)
    private readonly searchIndex: INoteSearchIndexPort,
  ) {}

  canHandle(topic: string): boolean {
    return topic === 'IndexNoteBody';
  }

  async handle(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (topic !== 'IndexNoteBody') return;

    const { noteId, plainText } = payload as unknown as IndexNoteBodyPayload;

    this.logger.log(`Processing IndexNoteBody job for note ${noteId}`);

    try {
      await this.searchIndex.updateBodyText(noteId, plainText);
      this.logger.log(`Successfully updated search body for note ${noteId}`);
    } catch (error) {
      this.logger.error(`Failed to update search body for note ${noteId}. Throwing to outbox retry...`, error);
      throw error;
    }
  }
}
