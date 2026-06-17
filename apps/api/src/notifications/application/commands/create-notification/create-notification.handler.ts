import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNotificationCommand } from './create-notification.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';
import { NotificationEntity } from '../../../domain/entities/notification.entity';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<{ id: string }> {
    const { userId, type, title, message, data } = command;
    const notification = NotificationEntity.create(
      userId,
      type,
      title,
      message,
      data ? JSON.stringify(data) : null,
    );
    await this.notificationRepository.save(notification);
    return { id: notification.id };
  }
}
