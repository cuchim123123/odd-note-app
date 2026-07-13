import { CommandHandler, type ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNoteCommand } from './update-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '../../ports/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../ports/document-sync.port';
import { NoteTitle } from '../../../domain/value-objects/note-title.vo';
import { NoteNotFoundError, NotePermissionDeniedError } from '../../../domain/errors/note.errors';
import { CreateRevisionCommand } from '../create-revision/create-revision.command';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: UpdateNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, title, content, isPinned, labels } = command;

    const { note, personalIsPinned } = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      if (!note.canEdit(userId)) throw new NotePermissionDeniedError();

      if (title !== undefined) {
        note.rename(NoteTitle.create(title), userId);
      }

      await ctx.noteRepository.save(note);

      let personalIsPinnedResult = false;
      if (isPinned !== undefined) {
        const result = await ctx.userPreferencesRepository.upsertPin(userId, noteId, isPinned);
        personalIsPinnedResult = result.isPinned;
      } else {
        personalIsPinnedResult = await ctx.userPreferencesRepository.getPin(userId, noteId);
      }

      if (labels !== undefined) {
        await ctx.userPreferencesRepository.upsertLabel(userId, noteId, labels);
      }
      
      return { note, personalIsPinned: personalIsPinnedResult };
    });

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
