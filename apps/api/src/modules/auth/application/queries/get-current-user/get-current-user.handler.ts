import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../../domain/errors/auth-error';
import type { User } from '../../../domain/entities/user.entity';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { GetCurrentUserQuery } from './get-current-user.query';

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<User> {
    const user = await this.userRepo.findById(query.userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }
}
