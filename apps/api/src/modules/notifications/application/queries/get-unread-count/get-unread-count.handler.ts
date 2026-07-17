import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUnreadCountQuery } from '@modules/notifications/application/queries/get-unread-count/get-unread-count.query';
import { NOTIFICATION_QUERY_DAO, type INotificationQueryDao } from '@modules/notifications/application/ports/notification-query.dao.port';

@QueryHandler(GetUnreadCountQuery)
export class GetUnreadCountHandler implements IQueryHandler<GetUnreadCountQuery> {
  constructor(
    @Inject(NOTIFICATION_QUERY_DAO)
    private readonly notificationDao: INotificationQueryDao,
  ) {}

  async execute(query: GetUnreadCountQuery): Promise<{ count: number }> {
    const count = await this.notificationDao.countUnread(query.userId);
    return { count };
  }
}
