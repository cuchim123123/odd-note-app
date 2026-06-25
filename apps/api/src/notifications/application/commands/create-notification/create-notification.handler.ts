import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateNotificationCommand } from './create-notification.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';
import { NotificationEntity } from '../../../domain/entities/notification.entity';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<CreateNotificationCommand> {
  private readonly logger = new Logger(CreateNotificationHandler.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<{ id: string }> {
    const { userId, type, title, message, data, eventId } = command;

    // Idempotency guard: if this eventId was already processed, skip silently.
    // This protects against Kafka at-least-once redelivery creating duplicate notifications.
    if (eventId) {
      const alreadyExists = await this.notificationRepository.existsByEventId(eventId);
      if (alreadyExists) {
        this.logger.warn(`Skipping duplicate notification for eventId=${eventId}`);
        // Return a stable sentinel id — callers should not depend on this id for duplicates
        return { id: 'duplicate-skipped' };
      }
    }

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
