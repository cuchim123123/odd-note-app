import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateShareCommand } from './update-share.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(UpdateShareCommand)
export class UpdateShareHandler implements ICommandHandler<UpdateShareCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    private readonly prisma: PrismaService, // For DB-level share update
  ) {}

  async execute(command: UpdateShareCommand): Promise<{ id: string }> {
    const { userId, noteId, shareId, permission } = command;

    // Load aggregate — includes share list
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its shares');
    }

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) {
      throw new NotFoundException('Share record not found');
    }

    // Domain invariant: updateShare() verifies only the owner can change permission
    const newPermissionVO = SharePermission.create(permission);
    note.updateShare(shareId, newPermissionVO, userId);

    // Persist aggregate + update DB share record
    await this.noteRepository.save(note);

    const updatedShare = await this.prisma.noteShare.update({
      where: { id: shareId },
      data: { permission },
    });

    return { id: updatedShare.id };
  }
}
