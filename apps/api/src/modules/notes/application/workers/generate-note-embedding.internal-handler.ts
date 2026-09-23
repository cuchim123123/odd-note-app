import { Injectable, Logger, Inject } from '@nestjs/common';
import type { IInternalCommandHandler } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { EMBEDDING_PROVIDER_PORT, type IEmbeddingProviderPort } from '@modules/notes/application/ports/external/embedding-provider.port';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';

interface GenerateNoteEmbeddingPayload {
  noteId: string;
  plainText: string;
  targetSeq: string;
}

@Injectable()
export class GenerateNoteEmbeddingInternalHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(GenerateNoteEmbeddingInternalHandler.name);

  constructor(
    @Inject(EMBEDDING_PROVIDER_PORT)
    private readonly embeddingProvider: IEmbeddingProviderPort,
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outboxPort: INoteOutboxPort,
  ) {}

  canHandle(topic: string): boolean {
    return topic === 'GenerateNoteEmbedding';
  }

  async handle(topic: string, payload: unknown): Promise<void> {
    if (topic !== 'GenerateNoteEmbedding') return;
    
    const { noteId, plainText, targetSeq } = payload as unknown as GenerateNoteEmbeddingPayload;
    
    this.logger.log(`Processing GenerateNoteEmbedding for note ${noteId} at seq ${targetSeq}`);

    // Generate dense vector using provider
    const embedding = await this.embeddingProvider.generateEmbedding(plainText);

    // Instead of using a Domain Event (since embeddings don't belong in Postgres),
    // we directly schedule the Integration Event for OpenSearch projection.
    await this.outboxPort.scheduleIntegrationEvent('NoteEmbeddingGenerated', {
      noteId,
      embedding,
      snapshotSeq: targetSeq,
    });
  }
}
