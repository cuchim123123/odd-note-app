import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from '@modules/notes/application/commands/share-note/share-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/unit-of-work.port';
import { USER_READ_PORT, type IUserReadPort } from '@modules/notes/application/ports/user-read.port';
import { SharePermission } from '@modules/notes/domain/value-objects/share-permission.vo';
import { NoteNotFoundError, NoteAlreadySharedError } from '@modules/notes/domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '@modules/notes/domain/errors/share.errors';
import { NOTE_MAIL_SENDER, type INoteMailSender } from '@modules/notes/application/ports/note-mail-sender.port';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    @Inject(NOTE_MAIL_SENDER)
    private readonly mailSender: INoteMailSender,
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
