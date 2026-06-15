import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { RevokeShareCommand } from './revoke-share.command';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(RevokeShareCommand)
export class RevokeShareHandler implements ICommandHandler<RevokeShareCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RevokeShareCommand): Promise<void> {
    const { userId, noteId, shareId } = command;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      include: { shares: { select: { id: true } } },
    });

    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its shares');
    }

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) {
      throw new NotFoundException('Share record not found');
    }

    await this.prisma.noteShare.delete({
      where: { id: shareId },
    });

    // If no shares left, mark note as not shared
    if (note.shares.length === 1) {
      await this.prisma.note.update({
        where: { id: noteId },
        data: { isShared: false },
      });
    }
  }
}
