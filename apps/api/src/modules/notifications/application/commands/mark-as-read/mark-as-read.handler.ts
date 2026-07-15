import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotificationNotFoundError, NotificationPermissionDeniedError } from '@modules/notifications/domain/errors/notification.errors';
import { MarkAsReadCommand } from '@modules/notifications/application/commands/mark-as-read/mark-as-read.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: MarkAsReadCommand): Promise<{ id: string }> {
    const { userId, notificationId } = command;
    const notification = await this.notificationRepository.findById(notificationId);
    
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    if (notification.userId !== userId) {
      throw new NotificationPermissionDeniedError();
    }

    notification.markAsRead();
    await this.notificationRepository.save(notification);

    return { id: notification.id };
  }
}
