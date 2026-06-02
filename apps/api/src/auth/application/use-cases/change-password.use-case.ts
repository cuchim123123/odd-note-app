import { Injectable, Inject } from '@nestjs/common';
import { UserNotFoundError, IncorrectPasswordError } from '../../domain/errors/auth-error';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../../../config';
import type { ChangePasswordOutput } from '@odd-note-app/validation';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class ChangePasswordUseCase {
  private readonly passwordSaltRounds: number;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly authConfig: AuthConfigService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async execute(userId: string, input: ChangePasswordOutput): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    const isPasswordValid = await bcrypt.compare(input.currentPassword!, user.passwordHash);
    if (!isPasswordValid) {
      throw new IncorrectPasswordError();
    }

    const passwordHash = await bcrypt.hash(input.newPassword!, this.passwordSaltRounds);
    await this.userRepo.update(userId, { passwordHash });
  }
}
