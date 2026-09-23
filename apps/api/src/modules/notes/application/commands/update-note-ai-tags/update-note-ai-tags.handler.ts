import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UpdateNoteAITagsCommand } from './update-note-ai-tags.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { NoteNotFoundError } from '@modules/notes/domain/errors/note.errors';

@CommandHandler(UpdateNoteAITagsCommand)
export class UpdateNoteAITagsHandler implements ICommandHandler<UpdateNoteAITagsCommand> {
  private readonly logger = new Logger(UpdateNoteAITagsHandler.name);

  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly uow: INoteUnitOfWork,
  ) {}

  async execute(command: UpdateNoteAITagsCommand): Promise<void> {
    const { noteId, aiTags, snapshotSeq } = command;

    await this.uow.execute(async (ctx) => {
      const note = await ctx.repos.note.findById(noteId);
      if (!note) {
        throw new NoteNotFoundError(noteId);
      }

      note.updateAITags(aiTags, BigInt(snapshotSeq));

      await ctx.repos.note.update(note);
      
      this.logger.debug(`Processed AI Tags update for note ${noteId} at seq ${snapshotSeq}`);
    });
  }
}
