import { Injectable, Inject } from '@nestjs/common';
import { UserNotFoundError } from '../../../domain/errors/auth-error';
import type { User } from '../../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';

@Injectable()
export class GetCurrentUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }
}
