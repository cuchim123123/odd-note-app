import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { LoginInput } from '@odd-note-app/validation';
import type { LoginResult } from '../auth.types';
import { SessionTokenService } from '../services/session-token.service';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { IUserRepository } from '../ports/user.repository.port';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly sessionTokenService: SessionTokenService,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email!);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password!, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.sessionTokenService.generateAndStoreTokens(user.id);

    return {
      user: this.authUserMapper.toProfile(user),
      tokens,
    };
  }
}
