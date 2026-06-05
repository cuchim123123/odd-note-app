import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError, IncorrectPasswordError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { ChangePasswordCommand } from './change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.userRepo.findById(command.userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    const isPasswordValid = await this.passwordHasher.compare(command.input.oldPassword!, user.passwordHash);
    if (!isPasswordValid) {
      throw new IncorrectPasswordError();
    }

    const passwordHash = await this.passwordHasher.hash(command.input.newPassword!);
    const updatedUser = user.changePassword(passwordHash);
    
    await this.userRepo.save(updatedUser);
  }
}
