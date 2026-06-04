import { Injectable, Inject } from '@nestjs/common';
import { UserNotFoundError } from '../../../domain/errors/auth-error';
import { AuthUserMapper } from '../../../infrastructure/mappers/auth-user.mapper';
import type { AuthUserProfile } from '../../shared/auth.types';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';

@Injectable()
export class GetCurrentUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(userId: string): Promise<AuthUserProfile> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return this.authUserMapper.toProfile(user);
  }
}
