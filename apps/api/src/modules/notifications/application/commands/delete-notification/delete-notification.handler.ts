import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotificationNotFoundError, NotificationPermissionDeniedError } from '@modules/notifications/domain/errors/notification.errors';
import { DeleteNotificationCommand } from '@modules/notifications/application/commands/delete-notification/delete-notification.command';
import { NOTIFICATION_UNIT_OF_WORK, type INotificationUnitOfWork } from '@modules/notifications/application/ports/transactions/unit-of-work.port';

@CommandHandler(DeleteNotificationCommand)
export class DeleteNotificationHandler implements ICommandHandler<DeleteNotificationCommand> {
  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: INotificationUnitOfWork,
  ) {}

  async execute(command: DeleteNotificationCommand): Promise<void> {
    const { userId, notificationId } = command;
    
    await this.unitOfWork.execute(async ({ repos }) => {
      const notification = await repos.notification.findById(notificationId);
      
      if (!notification) {
        throw new NotificationNotFoundError(notificationId);
      }
      if (notification.userId !== userId) {
        throw new NotificationPermissionDeniedError();
      }

      await repos.notification.delete(notification.id);
    });
  }
}
