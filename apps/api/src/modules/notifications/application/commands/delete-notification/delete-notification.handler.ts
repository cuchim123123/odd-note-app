import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NotificationNotFoundError, NotificationPermissionDeniedError } from '../../../domain/errors/notification.errors';
import { DeleteNotificationCommand } from './delete-notification.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';

@CommandHandler(DeleteNotificationCommand)
export class DeleteNotificationHandler implements ICommandHandler<DeleteNotificationCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: DeleteNotificationCommand): Promise<void> {
    const { userId, notificationId } = command;
    const notification = await this.notificationRepository.findById(notificationId);
    
    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }
    if (notification.userId !== userId) {
      throw new NotificationPermissionDeniedError();
    }

    await this.notificationRepository.delete(notification.id);
  }
}
