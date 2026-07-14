import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MarkAllAsReadCommand } from './mark-all-as-read.command';
import { NOTIFICATION_REPOSITORY, type INotificationRepository } from '../../ports/notification.repository.port';

@CommandHandler(MarkAllAsReadCommand)
export class MarkAllAsReadHandler implements ICommandHandler<MarkAllAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(command: MarkAllAsReadCommand): Promise<{ count: number }> {
    const count = await this.notificationRepository.markAllAsRead(command.userId);
    return { count };
  }
}
