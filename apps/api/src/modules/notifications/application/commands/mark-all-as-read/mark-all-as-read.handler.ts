import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MarkAllAsReadCommand } from '@modules/notifications/application/commands/mark-all-as-read/mark-all-as-read.command';
import { NOTIFICATION_UNIT_OF_WORK, type INotificationUnitOfWork } from '@modules/notifications/application/ports/transactions/unit-of-work.port';

@CommandHandler(MarkAllAsReadCommand)
export class MarkAllAsReadHandler implements ICommandHandler<MarkAllAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: INotificationUnitOfWork,
  ) {}

  async execute(command: MarkAllAsReadCommand): Promise<{ count: number }> {
    return this.unitOfWork.execute(async ({ repos }) => {
      const count = await repos.notification.markAllAsRead(command.userId);
      return { count };
    });
  }
}
