import { CommandHandler, type ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNoteCommand } from './update-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';
import { NoteNotFoundError, NotePermissionDeniedError } from '../../domain/errors/note.errors';
import { USER_PREFERENCES_REPOSITORY, type IUserPreferencesRepository } from '../../application/ports/user-preferences.repository.port';
import { CreateRevisionCommand } from '../create-revision/create-revision.command';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(USER_PREFERENCES_REPOSITORY)
    private readonly userPreferencesRepository: IUserPreferencesRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: UpdateNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, title, content, isPinned, labels } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    if (!note.canEdit(userId)) throw new NotePermissionDeniedError();

    if (title !== undefined) {
      note.rename(NoteTitle.create(title), userId);
    }

    await this.noteRepository.save(note);

    let personalIsPinned = false;
    if (isPinned !== undefined) {
      const result = await this.userPreferencesRepository.upsertPin(userId, noteId, isPinned);
      personalIsPinned = result.isPinned;
    } else {
      personalIsPinned = await this.userPreferencesRepository.getPin(userId, noteId);
    }

    if (labels !== undefined) {
      await this.userPreferencesRepository.upsertLabel(userId, noteId, labels);
    }

    if (content !== undefined) {
      await this.documentSyncPort.persistSnapshot(
        noteId,
        note.title,
        content,
        personalIsPinned,
        note.updatedAt,
      );
      // Snapshot this version in the revision history
      await this.commandBus.execute(
        new CreateRevisionCommand(noteId, note.title, content, userId),
      );
    }

    return { id: note.id };
  }
}
