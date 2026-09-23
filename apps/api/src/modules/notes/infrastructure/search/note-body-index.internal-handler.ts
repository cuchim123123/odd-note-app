import { Injectable, Logger, Inject } from '@nestjs/common';
import { type IInternalCommandHandler } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { NOTE_SEARCH_INDEX_PORT } from '@modules/notes/application/ports/external/note-search-index.port';
import type { INoteSearchIndexPort } from '@modules/notes/application/ports/external/note-search-index.port';

interface UpdateNoteSearchBodyPayload {
  noteId: string;
  plainText: string;
  targetSeq: string;
}

@Injectable()
export class NoteBodyIndexInternalHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(NoteBodyIndexInternalHandler.name);

  constructor(
    @Inject(NOTE_SEARCH_INDEX_PORT)
    private readonly searchIndex: INoteSearchIndexPort,
  ) {}

  canHandle(topic: string): boolean {
    return topic === 'UpdateNoteSearchBody';
  }

  async handle(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (topic !== 'UpdateNoteSearchBody') return;

    const { noteId, plainText, targetSeq } = payload as unknown as UpdateNoteSearchBodyPayload;

    this.logger.log(`Processing UpdateNoteSearchBody job for note ${noteId} at seq ${targetSeq}`);

    try {
      await this.searchIndex.updateBodyText(noteId, plainText, BigInt(targetSeq));
      this.logger.log(`Successfully updated search body for note ${noteId}`);
    } catch (error) {
      this.logger.error(`Failed to update search body for note ${noteId}. Throwing to outbox retry...`, error);
      throw error;
    }
  }
}
