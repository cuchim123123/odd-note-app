import { Injectable, Inject } from '@nestjs/common';
import { AuthUserMapper } from '../../auth-user.mapper';
import type { AuthUserProfile } from '../../auth.types';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
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
