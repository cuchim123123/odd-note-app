import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotificationNotFoundError, NotificationPermissionDeniedError } from '../../../domain/errors/notification.errors';
import { MarkAsReadCommand } from './mark-as-read.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';

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
