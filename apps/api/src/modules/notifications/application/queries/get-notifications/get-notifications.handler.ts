import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetNotificationsQuery } from '@modules/notifications/application/queries/get-notifications/get-notifications.query';
import { NOTIFICATION_QUERY_DAO, type INotificationQueryDao } from '@modules/notifications/application/ports/notification-query.dao.port';

@QueryHandler(GetNotificationsQuery)
export class GetNotificationsHandler implements IQueryHandler<GetNotificationsQuery> {
  constructor(
    @Inject(NOTIFICATION_QUERY_DAO)
    private readonly notificationDao: INotificationQueryDao,
  ) {}

  async execute(query: GetNotificationsQuery) {
    const notifications = query.isRead === false 
      ? await this.notificationDao.findUnread(query.userId, query.limit, query.cursor)
      : await this.notificationDao.findByUserId(query.userId, query.limit, query.cursor);
    return notifications; // Directly return DTOs from DAO
  }
}
