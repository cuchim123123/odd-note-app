import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { DeleteNotificationCommand } from '../../../application/commands/delete-notification/delete-notification.command';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class DeleteNotificationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':id')
  async deleteNotification(
    @CurrentUser() userId: string,
    @Param('id') notificationId: string,
  ) {
    await this.commandBus.execute(new DeleteNotificationCommand(userId, notificationId));
    return { success: true };
  }
}
