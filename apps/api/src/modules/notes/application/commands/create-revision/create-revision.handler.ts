import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { CreateRevisionCommand } from './create-revision.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

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
      // Idempotency guard: If a revision for this targetSeq already exists, just return it.
      const existingRevision = await repos.revision.findByTargetSeq(noteId, targetSeq);
      if (existingRevision) {
        this.logger.log(`Revision for note ${noteId} at targetSeq ${targetSeq} already exists (Idempotent).`);
        return { id: existingRevision.id };
      }

      const revision = NoteRevisionEntity.create({
        id: uuidv7(),
        noteId,
        targetSeq,
        createdAt: new Date(),
        createdBy: userId,
        label: label ?? null,
      });

      // Save strictly the pointer, no heavy document state is duplicated
      await repos.revision.save(revision);

      return { id: revision.id };
    });
  }
}
