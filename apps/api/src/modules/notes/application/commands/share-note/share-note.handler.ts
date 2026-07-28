import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from '@modules/notes/application/commands/share-note/share-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { USER_READ_PORT, type IUserReadPort } from '@modules/notes/application/ports/dao/user-read.port';
import { SharePermission } from '@modules/notes/domain/value-objects/share-permission.vo';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { RecipientNotFoundError, SelfShareError } from '@modules/notes/domain/errors/share.errors';


@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    const recipient = await this.userReadPort.findByEmail(recipientEmail);
    if (!recipient) throw new RecipientNotFoundError(recipientEmail);
    if (recipient.id === userId) throw new SelfShareError();


    const shareId = await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.repos.note.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);



      const permissionVO = SharePermission.create(permission);
      note.shareWith(recipient.id, permissionVO, userId);

      await ctx.repos.note.save(note);

      const share = await ctx.repos.noteShare.create({
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      });

      return share.id;
    });

    return { id: shareId };
  }
}
