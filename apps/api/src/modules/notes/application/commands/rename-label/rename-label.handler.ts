import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RenameLabelCommand } from '@modules/notes/application/commands/rename-label/rename-label.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { Inject } from '@nestjs/common';

@CommandHandler(RenameLabelCommand)
export class RenameLabelHandler implements ICommandHandler<RenameLabelCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: RenameLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, oldName, newName } = command;

    if (!oldName.trim() || !newName.trim()) {
      throw new BadRequestException('Label names cannot be empty');
    }

    if (oldName === newName) return { updatedCount: 0 };

    return this.unitOfWork.execute(async ({ repos }) => {
      const updatedCount = await repos.userPreferences.renameLabel(userId, oldName, newName);
      return { updatedCount };
    });
  }
}
