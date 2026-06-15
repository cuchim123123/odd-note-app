import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UpdateShareCommand } from './update-share.command';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(UpdateShareCommand)
export class UpdateShareHandler implements ICommandHandler<UpdateShareCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateShareCommand): Promise<{ id: string }> {
    const { userId, noteId, shareId, permission } = command;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      include: { shares: { where: { id: shareId } } },
    });

    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its shares');
    }

    if (note.shares.length === 0) {
      throw new NotFoundException('Share record not found');
    }

    const updatedShare = await this.prisma.noteShare.update({
      where: { id: shareId },
      data: { permission },
    });

    return { id: updatedShare.id };
  }
}
