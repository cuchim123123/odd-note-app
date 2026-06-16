import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { DeleteLabelCommand } from './delete-label.command';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(DeleteLabelCommand)
export class DeleteLabelHandler implements ICommandHandler<DeleteLabelCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, labelName } = command;
    const label = labelName.trim();

    if (!label) throw new BadRequestException('Label name cannot be empty');

    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel"
      SET labels = array_remove(labels, ${label})
      WHERE "userId" = ${userId} AND ${label} = ANY(labels)
    `;

    return { updatedCount: Number(result) };
  }
}
