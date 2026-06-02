import { Injectable, Inject } from '@nestjs/common';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasher } from '../ports/password-hasher.port';
import { PasswordResetTokenService } from '../services/password-reset-token.service';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.passwordResetTokenService.validateAndMarkAsUsed(token);

    const hashedPassword = await this.passwordHasher.hash(newPassword);

    await this.userRepo.update(userId, { passwordHash: hashedPassword });
  }
}
