import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '../../application/ports/unit-of-work.port';
import { USER_READ_PORT, type IUserReadPort } from '../../application/ports/user-read.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NoteNotFoundError, NoteAlreadySharedError } from '../../domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '../../domain/errors/share.errors';
import { NOTE_MAIL_SENDER, type INoteMailSender } from '../../application/ports/note-mail-sender.port';
import { dispatchDomainEvents } from '../../../common/ddd';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    @Inject(NOTE_MAIL_SENDER)
    private readonly mailSender: INoteMailSender,
    private readonly eventBus: EventBus,
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

      const share = await ctx.noteShareRepository.create({
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      });

      // Domain events are dispatched here; NoteSharedEventHandler will
      // reactively pick up NoteSharedDomainEvent and schedule the Outbox message.
      await dispatchDomainEvents(note, this.eventBus);

      return share.id;
    });

    // Send email AFTER transaction commits successfully
    await this.mailSender.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: 'Note',
      noteId: noteId,
      permission,
    });

    return { id: shareId };
  }
}
