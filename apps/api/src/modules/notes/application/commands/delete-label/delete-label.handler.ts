import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { DeleteLabelCommand } from '@modules/notes/application/commands/delete-label/delete-label.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { Inject } from '@nestjs/common';

@CommandHandler(DeleteLabelCommand)
export class DeleteLabelHandler implements ICommandHandler<DeleteLabelCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: DeleteLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, labelName } = command;
    const label = labelName.trim();

    if (!label) throw new BadRequestException('Label name cannot be empty');

    return this.unitOfWork.execute(async ({ repos }) => {
      const updatedCount = await repos.userPreferences.deleteLabel(userId, label);
      return { updatedCount };
    });
  }
}
