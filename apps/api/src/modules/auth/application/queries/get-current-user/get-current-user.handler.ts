import { Inject } from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '@modules/auth/domain/errors/auth-error';
import { USER_QUERY_DAO, type IUserQueryDao, type UserView } from '@modules/auth/application/ports/user-query.dao.port';
import { GetCurrentUserQuery } from '@modules/auth/application/queries/get-current-user/get-current-user.query';

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<GetCurrentUserQuery> {
  constructor(
    @Inject(USER_QUERY_DAO) private readonly userQueryDao: IUserQueryDao,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<UserView> {
    const user = await this.userQueryDao.findById(query.userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }
}
