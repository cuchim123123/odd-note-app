import { CommandHandler, type ICommandHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNoteCommand } from '@modules/notes/application/commands/update-note/update-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/external/document-sync.port';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { NoteNotFoundError, NotePermissionDeniedError } from '@modules/notes/domain/errors/note.errors';


@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, title, content, isPinned, labels } = command;

    const { note } = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.repos.note.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      if (!note.canEdit(userId)) throw new NotePermissionDeniedError();

      if (title !== undefined) {
        note.rename(NoteTitle.create(title), userId);
      }

      await ctx.repos.note.save(note);

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

    // In the CRDT architecture, content updates happen via WebSockets and the NoteUpdate log.
    // The REST API only updates metadata (title, labels, pins).
    if (content !== undefined) {
      // A warning or error could be logged here, or handled if legacy support is needed.
    }

    return { id: note.id };
  }
}
