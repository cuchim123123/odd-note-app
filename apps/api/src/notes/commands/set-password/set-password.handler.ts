import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetPasswordCommand } from './set-password.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '../../application/ports/unit-of-work.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';

@CommandHandler(SetPasswordCommand)
export class SetPasswordHandler implements ICommandHandler<SetPasswordCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: SetPasswordCommand): Promise<{ isProtected: true }> {
    const { userId, noteId, password } = command;

    await this.unitOfWork.execute(async (ctx) => {
      const note = await ctx.noteRepository.findById(noteId);
      if (!note) throw new NoteNotFoundError(noteId);

      // markAsProtected() verifies ownership and raises NotePasswordSetDomainEvent
      note.markAsProtected(userId);

      // Persist aggregate state changes (isProtected flag)
      await ctx.noteRepository.save(note);

      // Delegate bcrypt hashing to the infrastructure port
      await ctx.protectionPort.setPassword(userId, noteId, password);
    });

    return { isProtected: true };
  }
}
