import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { GetNotificationsQuery } from '@modules/notifications/application/queries/get-notifications/get-notifications.query';
import { GetUnreadCountQuery } from '@modules/notifications/application/queries/get-unread-count/get-unread-count.query';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class GetNotificationsHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async getNotifications(
    @CurrentUser() userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('isRead') isRead?: string,
  ) {
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;

    const [data, { count: unreadCount }] = await Promise.all([
      this.queryBus.execute(new GetNotificationsQuery(userId, limitNum, cursor, isReadBool)),
      this.queryBus.execute(new GetUnreadCountQuery(userId)),
    ]);

    return { data, unreadCount };
  }
}
