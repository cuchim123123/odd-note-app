import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '../../application/ports/note-outbox.port';
import { NOTE_SHARE_REPOSITORY, type INoteShareRepository } from '../../application/ports/note-share.repository.port';
import { USER_READ_PORT, type IUserReadPort } from '../../application/ports/user-read.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NoteNotFoundError, NoteAlreadySharedError } from '../../domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '../../domain/errors/share.errors';
import { MailerService } from '../../../common/mailer/mailer.service';
import { dispatchDomainEvents } from '../../../common/ddd';
import type { NoteSharedIntegrationEvent } from '../../application/integration-events/note-shared.integration-event';
import { NoteSharedDomainEvent } from '../../domain/events/note-shared.domain-event';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_SHARE_REPOSITORY)
    private readonly noteShareRepository: INoteShareRepository,
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outbox: INoteOutboxPort,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    private readonly mailer: MailerService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    const recipient = await this.userReadPort.findByEmail(recipientEmail);
    if (!recipient) throw new RecipientNotFoundError(recipientEmail);
    if (recipient.id === userId) throw new SelfShareError();

    const permissionVO = SharePermission.create(permission);
    try {
      note.shareWith(recipient.id, recipient.email, permissionVO, userId);
    } catch (err) {
      if (err instanceof NoteAlreadySharedError) throw err;
      throw err;
    }

    await this.noteRepository.save(note);

    // Capture eventId BEFORE dispatch clears the domain events array
    const domainEvent = note.domainEvents.find(
      (e): e is NoteSharedDomainEvent => e instanceof NoteSharedDomainEvent,
    );

    await dispatchDomainEvents(note, this.eventBus);

    const share = await this.noteShareRepository.create({
      noteId,
      ownerId: userId,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      permission,
    });

    const owner = await this.userReadPort.findById(userId);
    await this.mailer.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: note.title,
      noteId: note.id,
      permission,
      appUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    });

    // Publish the typed integration event to the Outbox → Kafka pipeline.
    // Using the domain event's eventId as the idempotency key so both the
    // in-process and cross-process paths share the same correlation ID.
    const integrationEvent: NoteSharedIntegrationEvent = {
      eventId: domainEvent?.eventId ?? share.id,
      occurredOn: new Date().toISOString(),
      noteId,
      shareId: share.id,
      ownerId: userId,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      permission,
      noteTitle: note.title,
    };

    await this.outbox.scheduleIntegrationEvent(
      'NoteShared',
      integrationEvent as unknown as Record<string, unknown>,
    );

    return { id: share.id };
  }
}
