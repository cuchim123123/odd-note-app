import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteNoteCommand } from './delete-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(DeleteNoteCommand)
export class DeleteNoteHandler implements ICommandHandler<DeleteNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    private readonly prisma: PrismaService, // Temporary until full UoW
  ) {}

  async execute(command: DeleteNoteCommand): Promise<void> {
    const { userId, noteId } = command;

    // TODO: When repository fully implements load(), we should fetch the aggregate:
    // const note = await this.noteRepository.findById(noteId);
    // if (!note) throw new NotFoundException('Note not found');
    // note.delete(userId); // verifies owner and adds event

    // For now, we perform the exact validation the old service did
    const existing = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    // Use Prisma transaction to cascade delete
    // In strict DDD, the repository's delete method encapsulates this.
    await this.prisma.$transaction([
      this.prisma.noteProtection.deleteMany({ where: { userId, noteId } }),
      this.prisma.userNoteLabel.deleteMany({ where: { noteId } }),
      this.prisma.userNotePin.deleteMany({ where: { noteId } }),
      this.prisma.note.delete({ where: { id: noteId } }),
    ]);

    // Clear infrastructure states
    await this.documentSyncPort.clearState(noteId);

    // TODO: Publish NoteDeletedDomainEvent to trigger Gateway cleanup via Outbox
  }
}
