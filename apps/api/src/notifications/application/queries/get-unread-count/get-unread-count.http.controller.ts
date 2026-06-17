import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { GetUnreadCountQuery } from './get-unread-count.query';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class GetUnreadCountHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() userId: string) {
    const { count } = await this.queryBus.execute(new GetUnreadCountQuery(userId));
    return { unreadCount: count };
  }
}
