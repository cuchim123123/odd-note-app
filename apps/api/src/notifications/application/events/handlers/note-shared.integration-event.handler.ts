import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';
import { IntegrationEvent } from '../../../../common/ddd/integration-event';
import { CreateNotificationCommand } from '../../commands/create-notification/create-notification.command';
import { Logger } from '@nestjs/common';

@EventsHandler(IntegrationEvent)
export class NoteSharedIntegrationEventHandler implements IEventHandler<IntegrationEvent> {
  private readonly logger = new Logger(NoteSharedIntegrationEventHandler.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: IntegrationEvent) {
    if (event.topic !== 'NoteShared') {
      return;
    }

    this.logger.log(`Handling NoteShared integration event for recipient: ${event.payload.recipientEmail}`);

    const payload = event.payload as {
      noteId: string;
      shareId: string;
      ownerId: string;
      recipientId: string;
      recipientEmail: string;
      permission: string;
      noteTitle: string;
    };

    const notificationMessage = `A note "${payload.noteTitle}" has been shared with you (Permission: ${payload.permission})`;

    await this.commandBus.execute(
      new CreateNotificationCommand(
        payload.recipientId,
        'note_shared',
        'Note Shared',
        notificationMessage,
        {
          noteId: payload.noteId,
          shareId: payload.shareId,
          permission: payload.permission,
        },
      ),
    );
  }
}
