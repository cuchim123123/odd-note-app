import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RevokeShareCommand } from '@modules/notes/application/commands/revoke-share/revoke-share.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/unit-of-work.port';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';
import { ShareNotFoundError } from '@modules/notes/domain/errors/share.errors';

@CommandHandler(RevokeShareCommand)
export class RevokeShareHandler implements ICommandHandler<RevokeShareCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: RevokeShareCommand): Promise<void> {
    const { userId, noteId, shareId } = command;

    await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      const shareExists = note.shares.some((s) => s.id === shareId);
      if (!shareExists) throw new ShareNotFoundError(shareId);

      note.revokeShare(shareId, userId);

      await ctx.noteRepository.save(note);
      await ctx.noteShareRepository.delete(shareId);
    });
  }
}
