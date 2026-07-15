import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import type { User } from '@modules/auth/domain/entities/user.entity';
import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import { GetCurrentUserQuery } from '@modules/auth/application/queries/get-current-user/get-current-user.query';

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
