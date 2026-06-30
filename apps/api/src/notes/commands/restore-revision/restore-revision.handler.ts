import { CommandHandler, type ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RestoreRevisionCommand } from './restore-revision.command';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '../../application/ports/note-revision.repository.port';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { USER_PREFERENCES_REPOSITORY, type IUserPreferencesRepository } from '../../application/ports/user-preferences.repository.port';
import { NoteNotFoundError, NotePermissionDeniedError } from '../../domain/errors/note.errors';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';
import { CreateRevisionCommand } from '../create-revision/create-revision.command';

export class RevisionNotFoundError extends Error {
  constructor(revisionId: string) {
    super(`Revision "${revisionId}" not found`);
    this.name = 'RevisionNotFoundError';
  }
}

@CommandHandler(RestoreRevisionCommand)
export class RestoreRevisionHandler implements ICommandHandler<RestoreRevisionCommand> {
  constructor(
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(USER_PREFERENCES_REPOSITORY)
    private readonly userPreferencesRepository: IUserPreferencesRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: RestoreRevisionCommand): Promise<{ id: string }> {
    const { userId, noteId, revisionId } = command;

    // Load and authorize against the note aggregate
    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);
    if (!note.canEdit(userId)) throw new NotePermissionDeniedError('Only the note owner can restore a revision');

    // Load the target revision (full content needed)
    const revision = await this.revisionRepository.findById(revisionId);
    if (!revision || revision.noteId !== noteId) throw new RevisionNotFoundError(revisionId);

    // Apply the restored title to the aggregate domain object
    note.rename(NoteTitle.create(revision.title), userId);
    await this.noteRepository.save(note);

    // Push the restored content back to the document sync (Redis/Yjs)
    const isPinned = await this.userPreferencesRepository.getPin(userId, noteId);
    await this.documentSyncPort.persistSnapshot(
      noteId,
      revision.title,
      revision.content,
      isPinned,
      new Date(),
    );

    // Record the restore as a new revision entry (so history is append-only)
    await this.commandBus.execute(
      new CreateRevisionCommand(
        noteId,
        revision.title,
        revision.content,
        userId,
        `Restored from revision #${revision.revisionNumber}`,
      ),
    );

    return { id: noteId };
  }
}
