import { Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { MarkAllAsReadCommand } from './mark-all-as-read.command';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class MarkAllAsReadHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('read-all')
  async markAllAsRead(@CurrentUser() userId: string) {
    const { count } = await this.commandBus.execute(new MarkAllAsReadCommand(userId));
    return { markedCount: count };
  }
}
