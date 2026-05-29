import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../../../config';
import { PasswordResetTokenService } from '../services/password-reset-token.service';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { IUserRepository } from '../ports/user.repository.port';

@Injectable()
export class ResetPasswordUseCase {
  private readonly passwordSaltRounds: number;

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly authConfig: AuthConfigService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async execute(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.passwordResetTokenService.validateAndMarkAsUsed(token);

    const hashedPassword = await bcrypt.hash(newPassword, this.passwordSaltRounds);

    await this.userRepo.update(userId, { passwordHash: hashedPassword });
  }
}
