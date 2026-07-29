import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotificationNotFoundError, NotificationPermissionDeniedError } from '@modules/notifications/domain/errors/notification.errors';
import { MarkAsReadCommand } from '@modules/notifications/application/commands/mark-as-read/mark-as-read.command';
import { NOTIFICATION_UNIT_OF_WORK, type INotificationUnitOfWork } from '@modules/notifications/application/ports/transactions/unit-of-work.port';

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: INotificationUnitOfWork,
  ) {}

  async execute(command: MarkAsReadCommand): Promise<{ id: string }> {
    const { userId, notificationId } = command;
    
    return this.unitOfWork.execute(async ({ repos }) => {
      const notification = await repos.notification.findById(notificationId);
      
      if (!notification) {
        throw new NotificationNotFoundError(notificationId);
      }
      if (notification.userId !== userId) {
        throw new NotificationPermissionDeniedError();
      }

      notification.markAsRead();
      await repos.notification.save(notification);

      return { id: notification.id };
    });
  }
}
