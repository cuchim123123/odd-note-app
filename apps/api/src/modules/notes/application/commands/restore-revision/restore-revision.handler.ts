import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { RestoreRevisionCommand } from '@modules/notes/application/commands/restore-revision/restore-revision.command';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '@modules/notes/application/ports/repositories/note-revision.repository.port';
import { NOTE_REPOSITORY, type INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import { DOCUMENT_UPDATE_STORE, type IDocumentUpdateStore } from '@modules/notes/application/ports/stores/document-update.store.port';
import { NoteNotFoundError, NotePermissionDeniedError, NoteLockedForRestoreError } from '@modules/notes/domain/errors/note.errors';
import { ReplayCoordinator } from '@modules/notes/application/services/replay.coordinator';
import { RedisService } from '@shared/infrastructure/redis/redis.service';
import { IdempotencyService } from '@shared/infrastructure/idempotency/idempotency.service';

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
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_UPDATE_STORE)
    private readonly updateStore: IDocumentUpdateStore,
    private readonly replayCoordinator: ReplayCoordinator,
    private readonly redisService: RedisService,
    private readonly idempotencyService: IdempotencyService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RestoreRevisionCommand): Promise<{ id: string }> {
    const { userId, noteId, revisionId, idempotencyKey } = command;

    if (idempotencyKey) {
      const isNewRequest = await this.idempotencyService.checkAndAcquire('restore-revision', idempotencyKey);
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
    const revision = await this.revisionRepository.findById(revisionId);
    if (!revision || revision.noteId !== noteId) throw new RevisionNotFoundError(revisionId);

    // 3. Coordinate Replay for Target & Current States
    const noteLockKey = `note:restore_lock:${noteId}`;
    const acquiredNoteLock = await this.redisService.getClient().set(noteLockKey, 'locked', 'EX', 30, 'NX');
    if (!acquiredNoteLock) {
      throw new NoteLockedForRestoreError();
    }

    try {
      const targetStateBlob = await this.replayCoordinator.rebuildDocument(noteId, revision.targetSeq);
      const currentStateBlob = await this.replayCoordinator.getCurrentDocument(noteId);

      // 4. Compute structural diff (revert = minimal update to go from current → target)
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
      await this.redisService.getClient().del(noteLockKey);
    }

    return { id: noteId };
  }
}

