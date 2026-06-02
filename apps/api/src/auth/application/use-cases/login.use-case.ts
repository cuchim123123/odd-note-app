import { Injectable, Inject } from '@nestjs/common';
import { InvalidCredentialsError } from '../../domain/errors/auth-error';
import { PASSWORD_HASHER } from '../ports/password-hasher.port';
import type { PasswordHasher } from '../ports/password-hasher.port';
import type { LoginInput } from '@odd-note-app/validation';
import type { LoginResult } from '../auth.types';
import { SessionTokenService } from '../services/session-token.service';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email!);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(input.password!, user.passwordHash);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const tokens = await this.sessionTokenService.generateAndStoreTokens(user.id);

    return {
      user: this.authUserMapper.toProfile(user),
      tokens,
    };
  }
}
