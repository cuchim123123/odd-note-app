import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SaveDraftCommand } from '@modules/notes/application/commands/save-draft/save-draft.command';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '@modules/notes/application/ports/draft-cache.port';
import { NOTE_REPOSITORY, type INoteRepository } from '@modules/notes/application/ports/note.repository.port';
import { NotePermissionDeniedError } from '@modules/notes/domain/errors/note.errors';

@CommandHandler(SaveDraftCommand)
export class SaveDraftHandler implements ICommandHandler<SaveDraftCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
  ) {}

  async execute(command: SaveDraftCommand): Promise<void> {
    const { userId, noteId, title, content } = command;

    if (noteId !== 'new') {
      const note = await this.noteRepository.findById(noteId);

      if (!note || !note.canEdit(userId)) {
        // Return 404 if note doesn't exist; 403 if it does but user has no access.
        // We use NotePermissionDeniedError as the safe choice (hides existence).
        throw new NotePermissionDeniedError('Note not found or you do not have permission to edit it');
      }
    }

    await this.draftCachePort.saveDraft(userId, noteId, title, content);
  }
}
