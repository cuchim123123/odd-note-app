import { Injectable, Inject } from '@nestjs/common';
import { UserNotFoundError, IncorrectPasswordError } from '../../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../../ports/password-hasher.port';
import type { PasswordHasher } from '../../ports/password-hasher.port';
import type { ChangePasswordOutput } from '@odd-note-app/validation';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';

@Injectable()
export class ChangePasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(userId: string, input: ChangePasswordOutput): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    const isPasswordValid = await this.passwordHasher.compare(input.currentPassword!, user.passwordHash);
    if (!isPasswordValid) {
      throw new IncorrectPasswordError();
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword!);
    await this.userRepo.update(userId, { passwordHash });
  }
}
