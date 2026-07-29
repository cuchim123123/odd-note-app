import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateNotificationCommand } from '@modules/notifications/application/commands/create-notification/create-notification.command';
import { NOTIFICATION_UNIT_OF_WORK, type INotificationUnitOfWork } from '@modules/notifications/application/ports/transactions/unit-of-work.port';
import { NotificationEntity } from '@modules/notifications/domain/entities/notification.entity';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand> {
  private readonly logger = new Logger(CreateNotificationHandler.name);

  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: INotificationUnitOfWork,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<{ id: string }> {
    const { userId, type, title, message, data, eventId } = command;

    return this.unitOfWork.execute(async ({ repos }) => {
      const notification = NotificationEntity.create(
        userId,
        type,
        title,
        message,
        data ?? null,
        eventId ?? null,
      );

      await repos.notification.save(notification);
      return { id: notification.id };
    });
  }
}
