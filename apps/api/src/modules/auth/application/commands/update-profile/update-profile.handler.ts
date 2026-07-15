import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import type { User } from '@modules/auth/domain/entities/user.entity';
import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import { UpdateProfileCommand } from '@modules/auth/application/commands/update-profile/update-profile.command';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<User> {
    const user = await this.userRepo.findById(command.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const updatedUser = user.updateProfile(command.input.displayName, command.input.avatarUrl);
    await this.userRepo.save(updatedUser);

    return updatedUser;
  }
}
