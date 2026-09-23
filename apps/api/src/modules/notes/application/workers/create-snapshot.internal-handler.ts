import { Injectable, Logger, Inject } from '@nestjs/common';
import { type IInternalCommandHandler } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { SNAPSHOT_METADATA_REPOSITORY, type ISnapshotMetadataRepository } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { SNAPSHOT_STORAGE_PORT, type ISnapshotStoragePort } from '@modules/notes/application/ports/external/snapshot-storage.port';
import { ReplayCoordinator } from '@modules/notes/application/services/replay.coordinator';
import { NoteSnapshotMetadata } from '@modules/notes/domain/entities/note-snapshot-metadata.entity';
import { DOCUMENT_ENGINE_PORT, type IDocumentEnginePort } from '@modules/notes/application/ports/external/document-engine.port';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '@modules/notes/application/ports/messaging/note-outbox.port';
import { uuidv7 } from 'uuidv7';

interface CreateSnapshotPayload {
  noteId: string;
  targetSeq: string; // serialized BigInt
}

@Injectable()
export class CreateSnapshotInternalCommandHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(CreateSnapshotInternalCommandHandler.name);

  constructor(
    @Inject(SNAPSHOT_METADATA_REPOSITORY)
    private readonly snapshotMetadataRepository: ISnapshotMetadataRepository,
    @Inject(SNAPSHOT_STORAGE_PORT)
    private readonly snapshotStoragePort: ISnapshotStoragePort,
    @Inject(DOCUMENT_ENGINE_PORT)
    private readonly documentEngine: IDocumentEnginePort,
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outboxPort: INoteOutboxPort,
    private readonly replayCoordinator: ReplayCoordinator,
  ) {}

  canHandle(topic: string): boolean {
    return topic === 'CreateSnapshot';
  }

  async handle(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (topic !== 'CreateSnapshot') return;
    
    const { noteId, targetSeq: targetSeqStr } = payload as unknown as CreateSnapshotPayload;
    const targetSeq = BigInt(targetSeqStr);

    this.logger.log(`Processing CreateSnapshot job for note ${noteId} at seq ${targetSeq}`);

    try {
      // 1. Rebuild the document up to targetSeq
      const snapshotBlob = await this.replayCoordinator.rebuildDocument(noteId, targetSeq);

      // 2. Upload to S3
      const s3ObjectKey = await this.snapshotStoragePort.uploadSnapshot(noteId, targetSeq, snapshotBlob);

      // 3. Save pointer in Postgres
      const metadata = NoteSnapshotMetadata.create({
        id: uuidv7(),
        noteId,
        snapshotSeq: targetSeq,
        s3ObjectKey,
        createdAt: new Date(),
      });

      await this.snapshotMetadataRepository.save(metadata);

      // 4. Extract plain text and trigger search indexing
      const plainText = this.documentEngine.extractText(snapshotBlob);
      
      // We dispatch 3 separate commands so they can fail and retry independently
      // (e.g. if OpenAI rate limits us, we don't need to rebuild the document again)
      await Promise.all([
        this.outboxPort.scheduleInternalCommand('UpdateNoteSearchBody', {
          noteId,
          plainText,
          targetSeq: targetSeqStr,
        }),
        this.outboxPort.scheduleInternalCommand('GenerateNoteEmbedding', {
          noteId,
          plainText,
          targetSeq: targetSeqStr,
        }),
        this.outboxPort.scheduleInternalCommand('GenerateNoteAITags', {
          noteId,
          plainText,
          targetSeq: targetSeqStr,
        }),
      ]);
      
      this.logger.log(`Successfully created and stored snapshot for note ${noteId} at seq ${targetSeq}`);
    } catch (error) {
      // Re-throw so the OutboxProcessor catches it and applies exponential backoff / DLQ
      this.logger.error(`Failed to create snapshot for note ${noteId}. Throwing to outbox retry...`);
      throw error;
    }
  }
}
