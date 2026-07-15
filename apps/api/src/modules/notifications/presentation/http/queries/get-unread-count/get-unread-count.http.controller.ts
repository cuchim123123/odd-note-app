import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../../shared/presentation/http/decorators/current-user.decorator';
import { GetUnreadCountQuery } from '../../../../application/queries/get-unread-count/get-unread-count.query';

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
