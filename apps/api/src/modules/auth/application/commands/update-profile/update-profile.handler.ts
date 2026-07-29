import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import type { User } from '@modules/auth/domain/entities/user.entity';
import { UNIT_OF_WORK, type UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { UpdateProfileCommand } from '@modules/auth/application/commands/update-profile/update-profile.command';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<User> {
    return this.unitOfWork.execute(async ({ repos }) => {
      const user = await repos.user.findById(command.userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      const updatedUser = user.updateProfile(command.input.displayName, command.input.avatarUrl);
      await repos.user.save(updatedUser);

      return updatedUser;
    });
  }
}
