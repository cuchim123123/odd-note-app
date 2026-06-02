import { Injectable, Inject } from '@nestjs/common';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import type { AuthUserProfile } from '../auth.types';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(userId: string, input: { displayName?: string | undefined; avatarUrl?: string | null | undefined }): Promise<AuthUserProfile> {
    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
    }
    if (input.avatarUrl !== undefined) {
      data.avatarUrl = input.avatarUrl;
    }

    const user = await this.userRepo.update(userId, data);

    return this.authUserMapper.toProfile(user);
  }
}
