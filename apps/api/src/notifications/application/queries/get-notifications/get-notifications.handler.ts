import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetNotificationsQuery } from './get-notifications.query';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';

@QueryHandler(GetNotificationsQuery)
export class GetNotificationsHandler implements IQueryHandler<GetNotificationsQuery> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(query: GetNotificationsQuery) {
    const notifications = await this.notificationRepository.findByUserId(query.userId, query.limit, query.offset);
    return notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      data: n.data ? JSON.parse(n.data) : undefined,
      createdAt: n.createdAt.toISOString(),
    }));
  }
}
