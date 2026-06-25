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
  /** Forwarded from DomainEvent.eventId — enables idempotent notification creation. */
  eventId?: string;
}

@Controller()
export class NoteSharedKafkaController {
  private readonly logger = new Logger(NoteSharedKafkaController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern('NoteShared')
  async handleNoteSharedEvent(@Payload() message: NoteSharedPayload) {
    this.logger.log(`Handling NoteShared Kafka event for recipient: ${message.recipientEmail}`);

    const notificationMessage = `A note "${message.noteTitle}" has been shared with you (Permission: ${message.permission})`;

    await this.commandBus.execute(
      new CreateNotificationCommand(
        message.recipientId,
        'note_shared',
        'Note Shared',
        notificationMessage,
        {
          noteId: message.noteId,
          shareId: message.shareId,
          permission: message.permission,
        },
        message.eventId, // propagate for idempotent deduplication
      ),
    );
  }
}
