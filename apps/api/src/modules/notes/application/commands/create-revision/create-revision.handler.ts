import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateRevisionCommand } from './create-revision.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';

@CommandHandler(CreateRevisionCommand)
export class CreateRevisionHandler implements ICommandHandler<CreateRevisionCommand> {
  private readonly logger = new Logger(CreateRevisionHandler.name);

  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
  ) {}

  async execute(command: CreateRevisionCommand): Promise<{ id: string }> {
    const { noteId, userId, targetSeq, label } = command;

    this.logger.log(`Creating revision for note ${noteId} at targetSeq ${targetSeq}`);

    return this.unitOfWork.execute(async ({ repos }) => {
      const versionHistory = await repos.versionHistory.findByNoteId(noteId);
      
      const revision = versionHistory.addRevision(targetSeq, userId, label ?? null);

      await repos.versionHistory.save(versionHistory);

      return { id: revision.id };
    });
  }
}
