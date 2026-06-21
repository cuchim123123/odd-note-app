import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { CreateNotificationCommand } from '../../commands/create-notification/create-notification.command';

interface NoteSharedPayload {
  noteId: string;
  shareId: string;
  ownerId: string;
  recipientId: string;
  recipientEmail: string;
  permission: string;
  noteTitle: string;
}

@Controller()
export class NoteSharedKafkaController {
  private readonly logger = new Logger(NoteSharedKafkaController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern('NoteShared')
  async handleNoteSharedEvent(@Payload() message: NoteSharedPayload) {
    this.logger.log(`Handling NoteShared Kafka event for recipient: ${message.recipientEmail}`);

    const payload = message as {
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
