import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteNoteCommand } from './delete-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';

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

    // Load aggregate via repository (BUG-3 now fixed)
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Aggregate enforces the domain rule: only owner can delete
    // This throws NotePermissionDeniedError if userId is not the owner
    note.delete(userId);

    // Persist deletion (repository handles cascade in transaction)
    await this.noteRepository.delete(noteId);

    // Clean up Yjs / Redis state
    await this.documentSyncPort.clearState(noteId);

    // TODO Phase 4: NoteDeletedDomainEvent → Outbox → Kafka → Collaboration Gateway cleanup
  }
}
