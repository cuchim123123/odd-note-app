import { CommandHandler, type ICommandHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateNoteCommand } from '@modules/notes/application/commands/update-note/update-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/document-sync.port';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { NoteNotFoundError, NotePermissionDeniedError } from '@modules/notes/domain/errors/note.errors';
import { NoteContentSnapshotTakenEvent } from '@modules/notes/application/events/note-content-snapshot-taken.event';

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
      // Snapshot this version in the revision history by emitting an event
      this.eventBus.publish(
        new NoteContentSnapshotTakenEvent(noteId, note.title, content, userId),
      );
    }

    return { id: note.id };
  }
}
