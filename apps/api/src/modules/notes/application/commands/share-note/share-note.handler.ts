import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from '@modules/notes/application/commands/share-note/share-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/repositories/unit-of-work.port';
import { USER_READ_PORT, type IUserReadPort } from '@modules/notes/application/ports/services/user-read.port';
import { SharePermission } from '@modules/notes/domain/value-objects/share-permission.vo';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '@modules/notes/domain/errors/share.errors';
import { NOTE_MAIL_SENDER, type INoteMailSender } from '@modules/notes/application/ports/messaging/note-mail-sender.port';
import type { NoteSharedIntegrationEvent } from '@modules/notes/application/integration-events/note-shared.integration-event';
import { NOTE_INTEGRATION_EVENT_MAPPER, type INoteIntegrationEventMapper } from '@modules/notes/application/ports/messaging/integration-event-mapper.port';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    @Inject(NOTE_MAIL_SENDER)
    private readonly mailSender: INoteMailSender,
    @Inject(NOTE_INTEGRATION_EVENT_MAPPER)
    private readonly integrationEventMapper: INoteIntegrationEventMapper,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    const recipient = await this.userReadPort.findByEmail(recipientEmail);
    if (!recipient) throw new RecipientNotFoundError(recipientEmail);
    if (recipient.id === userId) throw new SelfShareError();
    const owner = await this.userReadPort.findById(userId);

    let noteTitle = 'Note';

    const shareId = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      noteTitle = note.title;

      const permissionVO = SharePermission.create(permission);
      note.shareWith(recipient.id, permissionVO, userId);

      await ctx.noteRepository.save(note);

      const share = await ctx.noteShareRepository.create({
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      });

      const outboxPayload: NoteSharedIntegrationEvent = {
        eventId: share.id,
        occurredOn: new Date().toISOString(),
        noteId,
        shareId: share.id,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
        noteTitle,
      };

      const draft = this.integrationEventMapper.serialize('NoteShared', outboxPayload);
      await ctx.outbox.scheduleIntegrationEvent(draft.topic, draft.payload);

      return share.id;
    });

    // Send email AFTER transaction commits successfully
    await this.mailSender.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle,
      noteId: noteId,
      permission,
    });

    return { id: shareId };
  }
}
