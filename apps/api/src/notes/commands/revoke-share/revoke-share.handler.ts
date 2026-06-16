import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { RevokeShareCommand } from './revoke-share.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(RevokeShareCommand)
export class RevokeShareHandler implements ICommandHandler<RevokeShareCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    private readonly prisma: PrismaService, // For DB-level share deletion
  ) {}

  async execute(command: RevokeShareCommand): Promise<void> {
    const { userId, noteId, shareId } = command;

    // Load aggregate — includes share list
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its shares');
    }

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) {
      throw new NotFoundException('Share record not found');
    }

    // Domain invariant: revokeShare() enforces owner-only, emits NoteShareRevokedDomainEvent
    note.revokeShare(shareId, userId);

    // Persist updated aggregate (isShared flag may have changed)
    await this.noteRepository.save(note);

    // Remove DB share record
    await this.prisma.noteShare.delete({ where: { id: shareId } });
  }
}
