import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { DeleteLabelCommand } from '@modules/notes/application/commands/delete-label/delete-label.command';
import { USER_PREFERENCES_REPOSITORY, type IUserPreferencesRepository } from '@modules/notes/application/ports/repositories/user-preferences.repository.port';
import { Inject } from '@nestjs/common';

@CommandHandler(DeleteLabelCommand)
export class DeleteLabelHandler implements ICommandHandler<DeleteLabelCommand> {
  constructor(
    @Inject(USER_PREFERENCES_REPOSITORY)
    private readonly userPreferencesRepository: IUserPreferencesRepository,
  ) {}

  async execute(command: DeleteLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, labelName } = command;
    const label = labelName.trim();

    if (!label) throw new BadRequestException('Label name cannot be empty');

    const updatedCount = await this.userPreferencesRepository.deleteLabel(userId, label);
    return { updatedCount };
  }
}
