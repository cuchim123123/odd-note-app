import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new UnauthorizedException('You do not own this notification');
    }

    await this.notificationRepository.delete(notification.id);
  }
}
