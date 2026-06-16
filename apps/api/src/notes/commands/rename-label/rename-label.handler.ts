import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RenameLabelCommand } from './rename-label.command';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(RenameLabelCommand)
export class RenameLabelHandler implements ICommandHandler<RenameLabelCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: RenameLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, oldName, newName } = command;

    if (!oldName.trim() || !newName.trim()) {
      throw new BadRequestException('Label names cannot be empty');
    }

    if (oldName === newName) return { updatedCount: 0 };

    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel"
      SET labels = array_replace(labels, ${oldName}, ${newName})
      WHERE "userId" = ${userId} AND ${oldName} = ANY(labels)
    `;

    return { updatedCount: Number(result) };
  }
}
