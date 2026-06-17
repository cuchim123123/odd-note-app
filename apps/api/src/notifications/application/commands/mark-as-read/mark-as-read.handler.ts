import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new UnauthorizedException('You do not own this notification');
    }

    notification.markAsRead();
    await this.notificationRepository.save(notification);

    return { id: notification.id };
  }
}
