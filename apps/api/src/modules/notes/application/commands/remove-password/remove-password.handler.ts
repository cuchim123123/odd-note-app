import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RemovePasswordCommand } from '@modules/notes/application/commands/remove-password/remove-password.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/unit-of-work.port';
import { NoteNotFoundError, IncorrectPasswordError } from '@modules/notes/domain/errors/note.errors';

@CommandHandler(RemovePasswordCommand)
export class RemovePasswordHandler implements ICommandHandler<RemovePasswordCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: RemovePasswordCommand): Promise<{ removed: true }> {
    const { userId, noteId, password } = command;

    await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note || !note.isOwner(userId)) {
        throw new NoteNotFoundError(noteId); // 404 to avoid oracle attack
      }

      const isValid = await ctx.protectionPort.verifyPassword(userId, noteId, password);
      if (!isValid) throw new IncorrectPasswordError();

      await ctx.protectionPort.removePassword(userId, noteId);
    });
    
    return { removed: true };
  }
}
