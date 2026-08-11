import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RestoreRevisionCommand } from '@modules/notes/application/commands/restore-revision/restore-revision.command';
import { VERSION_HISTORY_REPOSITORY, type IVersionHistoryRepository } from '@modules/notes/application/ports/repositories/version-history.repository.port';
import { NOTE_REPOSITORY, type INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import { DOCUMENT_UPDATE_STORE, type IDocumentUpdateStore } from '@modules/notes/application/ports/stores/document-update.store.port';
import { NoteNotFoundError, NotePermissionDeniedError, NoteLockedForRestoreError } from '@modules/notes/domain/errors/note.errors';
import { ReplayCoordinator } from '@modules/notes/application/services/replay.coordinator';
import { DISTRIBUTED_LOCK_PORT, type IDistributedLockPort } from '@shared/application/ports/distributed-lock.port';
import { IDEMPOTENCY_PORT, type IIdempotencyPort } from '@shared/application/ports/idempotency.port';

export class RevisionNotFoundError extends Error {
  constructor(revisionId: string) {
    super(`Revision "${revisionId}" not found`);
    this.name = 'RevisionNotFoundError';
  }
}

@CommandHandler(RestoreRevisionCommand)
export class RestoreRevisionHandler implements ICommandHandler<RestoreRevisionCommand> {
  private readonly logger = new Logger(RestoreRevisionHandler.name);

  constructor(
    @Inject(VERSION_HISTORY_REPOSITORY)
    private readonly versionHistoryRepository: IVersionHistoryRepository,
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_UPDATE_STORE)
    private readonly updateStore: IDocumentUpdateStore,
    private readonly replayCoordinator: ReplayCoordinator,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly lockPort: IDistributedLockPort,
    @Inject(IDEMPOTENCY_PORT)
    private readonly idempotencyPort: IIdempotencyPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RestoreRevisionCommand): Promise<{ id: string }> {
    const { userId, noteId, revisionId, idempotencyKey } = command;

    if (idempotencyKey) {
      const isNewRequest = await this.idempotencyPort.checkAndAcquire('restore-revision', idempotencyKey);
      if (!isNewRequest) {
        this.logger.log(`Idempotency key ${idempotencyKey} already processed. Skipping restore.`);
        return { id: noteId };
      }
    }

    // 1. Authorize against the note aggregate
    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);
    if (!note.isOwner(userId)) throw new NotePermissionDeniedError('Only the note owner can restore a revision');

    // 2. Load the target revision to get the pointer (targetSeq)
    const versionHistory = await this.versionHistoryRepository.findByNoteId(noteId);
    const revision = versionHistory.getRevision(revisionId);
    if (!revision) throw new RevisionNotFoundError(revisionId);

    // 3. Coordinate Replay for Target & Current States
    const acquiredNoteLock = await this.lockPort.acquireLock(`restore_lock:${noteId}`, 30);
    if (!acquiredNoteLock) {
      throw new NoteLockedForRestoreError();
    }

    try {
      const targetStateBlob = await this.replayCoordinator.rebuildDocument(noteId, revision.targetSeq);
      const currentStateBlob = await this.replayCoordinator.getCurrentDocument(noteId);

      // 4. Compute structural diff (revert = minimal update to go from current -> target)
      const revertingUpdateBlob = this.replayCoordinator.computeRevertingUpdate(
        currentStateBlob,
        targetStateBlob
      );

      // 5. Append the resulting CRDT update to the update log (Source of Truth)
      await this.updateStore.append({
        noteId,
        authorId: userId,
        updateBlob: revertingUpdateBlob,
        sizeBytes: revertingUpdateBlob.byteLength,
        createdAt: new Date(),
      });
    } finally {
      await this.lockPort.releaseLock(`restore_lock:${noteId}`);
    }

    return { id: noteId };
  }
}

