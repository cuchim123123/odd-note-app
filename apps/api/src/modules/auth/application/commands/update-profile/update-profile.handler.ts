import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../../domain/errors/auth-error';
import type { User } from '../../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { UpdateProfileCommand } from './update-profile.command';

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
