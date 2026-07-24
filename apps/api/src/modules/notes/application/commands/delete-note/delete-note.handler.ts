import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteNoteCommand } from '@modules/notes/application/commands/delete-note/delete-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/repositories/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/services/document-sync.port';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';

@CommandHandler(DeleteNoteCommand)
export class DeleteNoteHandler implements ICommandHandler<DeleteNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(command: DeleteNoteCommand): Promise<void> {
    const { userId, noteId } = command;

    await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      // Aggregate enforces: only owner can delete (throws NotePermissionDeniedError)
      note.delete(userId);

      await ctx.noteRepository.delete(noteId);
      
      // TODO Phase 4: NoteDeletedDomainEvent → Outbox → Kafka → Collaboration Gateway cleanup
    });

    await this.documentSyncPort.clearState(noteId);
  }
}
