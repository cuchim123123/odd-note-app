import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import type { PasswordHasher } from '@modules/auth/application/ports/password-hasher.port';
import { UNIT_OF_WORK, type UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { ChangePasswordCommand } from '@modules/auth/application/commands/change-password/change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    await this.unitOfWork.execute(async ({ repos }) => {
      const user = await repos.user.findById(command.userId);

      if (!user) {
        throw new UserNotFoundError();
      }

      await user.verifyCurrentPassword(command.input.oldPassword!, this.passwordHasher);

      const passwordHash = await this.passwordHasher.hash(command.input.newPassword!);
      const updatedUser = user.changePassword(passwordHash);
      
      await repos.user.save(updatedUser);
    });
  }
}
