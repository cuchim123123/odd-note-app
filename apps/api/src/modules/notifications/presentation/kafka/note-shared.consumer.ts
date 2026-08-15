import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { CreateNotificationCommand } from '@modules/notifications/application/commands/create-notification/create-notification.command';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

interface NoteSharedPayload {
  shareId: string;
  ownerId: string;
  recipientId: string;
  permission: string;
  title: string;
}

@Controller()
export class NoteSharedConsumer {
  private readonly logger = new Logger(NoteSharedConsumer.name);

  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  @EventPattern('NoteShared')
  async handleNoteSharedEvent(@Payload() message: IntegrationEventEnvelope<NoteSharedPayload>) {
    this.logger.log(`Handling NoteShared Kafka event for recipient: ${message.payload.recipientId}`);

    const title = message.payload.title ?? 'A Note';
    const notificationMessage = `A note "${title}" has been shared with you (Permission: ${message.payload.permission})`;

    await this.commandBus.execute(
      new CreateNotificationCommand(
        message.payload.recipientId,
        'note_shared',
        'Note Shared',
        notificationMessage,
        {
          noteId: message.aggregateId,
          shareId: message.payload.shareId,
          permission: message.payload.permission,
        },
        message.eventId, // propagate for idempotent deduplication
      ),
    );
  }
}
