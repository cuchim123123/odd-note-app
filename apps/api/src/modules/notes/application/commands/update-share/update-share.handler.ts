import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateShareCommand } from '@modules/notes/application/commands/update-share/update-share.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { SharePermission } from '@modules/notes/domain/value-objects/share-permission.vo';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { ShareNotFoundError } from '@modules/notes/domain/errors/share.errors';

@CommandHandler(UpdateShareCommand)
export class UpdateShareHandler implements ICommandHandler<UpdateShareCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: UpdateShareCommand): Promise<{ id: string }> {
    const { userId, noteId, shareId, permission } = command;

    return this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      const shareExists = note.shares.some((s) => s.id === shareId);
      if (!shareExists) throw new ShareNotFoundError(shareId);

      const newPermissionVO = SharePermission.create(permission);
      note.updateShare(shareId, newPermissionVO, userId);

      await ctx.noteRepository.save(note);
      const updatedShare = await ctx.noteShareRepository.updatePermission(shareId, permission);
      return { id: updatedShare.id };
    });
  }
}
