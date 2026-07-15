import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { MarkAsReadCommand } from '@modules/notifications/application/commands/mark-as-read/mark-as-read.command';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class MarkAsReadHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':id/read')
  async markAsRead(
    @CurrentUser() userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.commandBus.execute(new MarkAsReadCommand(userId, notificationId));
  }
}
