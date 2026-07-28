import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { CreateNotificationCommand } from '@modules/notifications/application/commands/create-notification/create-notification.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

interface NoteSharedPayload {
  noteId: string;
  shareId: string;
  ownerId: string;
  recipientId: string;
  permission: string;
  /** Forwarded from DomainEvent.eventId — enables idempotent notification creation. */
  eventId?: string;
}

@Controller()
export class NoteSharedConsumer {
  private readonly logger = new Logger(NoteSharedConsumer.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  @EventPattern('NoteShared')
  async handleNoteSharedEvent(@Payload() message: NoteSharedPayload) {
    this.logger.log(`Handling NoteShared Kafka event for recipient: ${message.recipientId}`);

    // Enrich event with required data via direct DB read (Read Model / Dao equivalent)
    const note = await this.prisma.note.findUnique({ where: { id: message.noteId }, select: { title: true } });

    const title = note?.title ?? 'A Note';
    const notificationMessage = `A note "${title}" has been shared with you (Permission: ${message.permission})`;

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
