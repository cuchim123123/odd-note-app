import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetNotificationsQuery } from '@modules/notifications/application/queries/get-notifications/get-notifications.query';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';

@QueryHandler(GetNotificationsQuery)
export class GetNotificationsHandler implements IQueryHandler<GetNotificationsQuery> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(query: GetNotificationsQuery) {
    const notifications = query.isRead === false 
      ? await this.notificationRepository.findUnread(query.userId, query.limit, query.cursor)
      : await this.notificationRepository.findByUserId(query.userId, query.limit, query.cursor);
    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      data: n.data ?? undefined,
      createdAt: n.createdAt.toISOString(),
    }));
  }
}
