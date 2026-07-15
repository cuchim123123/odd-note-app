import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUnreadCountQuery } from '@modules/notifications/application/queries/get-unread-count/get-unread-count.query';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';

@QueryHandler(GetUnreadCountQuery)
export class GetUnreadCountHandler implements IQueryHandler<GetUnreadCountQuery> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(query: GetUnreadCountQuery): Promise<{ count: number }> {
    const count = await this.notificationRepository.countUnread(query.userId);
    return { count };
  }
}
