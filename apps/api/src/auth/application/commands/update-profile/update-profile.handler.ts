import { Injectable, Inject } from '@nestjs/common';
import type { User } from '../../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';

@Injectable()
export class UpdateProfileHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async execute(userId: string, input: { displayName?: string | undefined; avatarUrl?: string | null | undefined }): Promise<User> {
    const data: { displayName?: string; avatarUrl?: string | null } = {};
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
    }
    if (input.avatarUrl !== undefined) {
      data.avatarUrl = input.avatarUrl;
    }

    return this.userRepo.update(userId, data);
  }
}
