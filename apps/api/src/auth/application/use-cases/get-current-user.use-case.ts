import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import type { AuthUserProfile } from '../auth.types';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { IUserRepository } from '../ports/user.repository.port';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async execute(userId: string): Promise<AuthUserProfile> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.authUserMapper.toProfile(user);
  }
}
