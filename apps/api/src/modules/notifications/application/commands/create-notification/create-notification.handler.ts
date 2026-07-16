import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateNotificationCommand } from '@modules/notifications/application/commands/create-notification/create-notification.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';
import { NotificationEntity } from '@modules/notifications/domain/entities/notification.entity';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand> {
  private readonly logger = new Logger(CreateNotificationHandler.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<{ id: string }> {
    const { userId, type, title, message, data, eventId } = command;



    const notification = NotificationEntity.create(
      userId,
      type,
      title,
      message,
      data ?? null,
      eventId ?? null,
    );

    await this.notificationRepository.save(notification);
    return { id: notification.id };
  }
}
