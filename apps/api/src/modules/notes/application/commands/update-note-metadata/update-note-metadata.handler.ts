import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNoteMetadataCommand } from '@modules/notes/application/commands/update-note-metadata/update-note-metadata.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { NoteNotFoundError, NotePermissionDeniedError } from '@modules/notes/domain/errors/note.errors';

@CommandHandler(UpdateNoteMetadataCommand)
export class UpdateNoteMetadataHandler implements ICommandHandler<UpdateNoteMetadataCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: UpdateNoteMetadataCommand): Promise<{ id: string }> {
    const { userId, noteId, title, isPinned, labels } = command;

    const { note } = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.repos.note.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      if (!note.hasAccess(userId)) {
        throw new NotePermissionDeniedError();
      }

      if (title !== undefined) {
        note.rename(NoteTitle.create(title), userId);
        await ctx.repos.note.update(note);
      }

      let personalIsPinnedResult = false;
      if (isPinned !== undefined) {
        const result = await ctx.repos.userPreferences.upsertPin(userId, noteId, isPinned);
        personalIsPinnedResult = result.isPinned;
      } else {
        personalIsPinnedResult = await ctx.repos.userPreferences.getPin(userId, noteId);
      }

      if (labels !== undefined) {
        await ctx.repos.userPreferences.upsertLabel(userId, noteId, labels);
      }
      
      return { note, personalIsPinned: personalIsPinnedResult };
    });

    return { id: note.id };
  }
}
