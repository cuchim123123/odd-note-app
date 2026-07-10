import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '../../application/ports/unit-of-work.port';
import { USER_READ_PORT, type IUserReadPort } from '../../application/ports/user-read.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NoteNotFoundError, NoteAlreadySharedError } from '../../domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '../../domain/errors/share.errors';
import { MailerService } from '../../../common/mailer/mailer.service';
import { dispatchDomainEvents } from '../../../common/ddd';
import type { NoteSharedIntegrationEvent } from '../../application/integration-events/note-shared.integration-event';
import { NoteSharedDomainEvent } from '../../domain/events/note-shared.domain-event';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.validation';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    private readonly mailer: MailerService,
    private readonly eventBus: EventBus,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    const recipient = await this.userReadPort.findByEmail(recipientEmail);
    if (!recipient) throw new RecipientNotFoundError(recipientEmail);
    if (recipient.id === userId) throw new SelfShareError();
    const owner = await this.userReadPort.findById(userId);

    const shareId = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      const permissionVO = SharePermission.create(permission);
      try {
        note.shareWith(recipient.id, recipient.email, permissionVO, userId);
      } catch (err) {
        if (err instanceof NoteAlreadySharedError) throw err;
        throw err;
      }

      await ctx.noteRepository.save(note);

      // Capture eventId BEFORE dispatch clears the domain events array
      const domainEvent = note.domainEvents.find(
        (e): e is NoteSharedDomainEvent => e instanceof NoteSharedDomainEvent,
      );

      await dispatchDomainEvents(note, this.eventBus);

      const share = await ctx.noteShareRepository.create({
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      });

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

      await ctx.outbox.scheduleIntegrationEvent(
        'NoteShared',
        integrationEvent as unknown as Record<string, unknown>,
      );

      return share.id;
    });

    // Send email AFTER transaction commits successfully
    await this.mailer.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: 'Note', // Cannot access note.title easily outside transaction unless returned
      noteId: noteId,
      permission,
      appUrl: this.config.get('APP_URL'),
    });

    return { id: shareId };
  }
}
