import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { RenameLabelCommand } from '@modules/notes/application/commands/rename-label/rename-label.command';
import { USER_PREFERENCES_REPOSITORY, type IUserPreferencesRepository } from '@modules/notes/application/ports/repositories/user-preferences.repository.port';
import { Inject } from '@nestjs/common';

@CommandHandler(RenameLabelCommand)
export class RenameLabelHandler implements ICommandHandler<RenameLabelCommand> {
  constructor(
    @Inject(USER_PREFERENCES_REPOSITORY)
    private readonly userPreferencesRepository: IUserPreferencesRepository,
  ) {}

  async execute(command: RenameLabelCommand): Promise<{ updatedCount: number }> {
    const { userId, oldName, newName } = command;

    if (!oldName.trim() || !newName.trim()) {
      throw new BadRequestException('Label names cannot be empty');
    }

    if (oldName === newName) return { updatedCount: 0 };

    const updatedCount = await this.userPreferencesRepository.renameLabel(userId, oldName, newName);
    return { updatedCount };
  }
}
