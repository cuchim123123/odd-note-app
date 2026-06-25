import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteNoteCommand } from './delete-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';

@CommandHandler(DeleteNoteCommand)
export class DeleteNoteHandler implements ICommandHandler<DeleteNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(command: DeleteNoteCommand): Promise<void> {
    const { userId, noteId } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    // Aggregate enforces: only owner can delete (throws NotePermissionDeniedError)
    note.delete(userId);

    await this.noteRepository.delete(noteId);
    await this.documentSyncPort.clearState(noteId);

    // TODO Phase 4: NoteDeletedDomainEvent → Outbox → Kafka → Collaboration Gateway cleanup
  }
}
