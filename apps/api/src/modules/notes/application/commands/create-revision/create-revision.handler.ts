import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { CreateRevisionCommand } from './create-revision.command';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '@modules/notes/application/ports/repositories/note-revision.repository.port';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

@CommandHandler(CreateRevisionCommand)
export class CreateRevisionHandler implements ICommandHandler<CreateRevisionCommand> {
  private readonly logger = new Logger(CreateRevisionHandler.name);

  constructor(
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async execute(command: CreateRevisionCommand): Promise<{ id: string }> {
    const { noteId, userId, targetSeq, label } = command;

    this.logger.log(`Creating revision for note ${noteId} at targetSeq ${targetSeq}`);

    const revision = NoteRevisionEntity.create({
      id: uuidv7(),
      noteId,
      targetSeq,
      createdAt: new Date(),
      createdBy: userId,
      label: label ?? null,
    });

    // Save strictly the pointer, no heavy document state is duplicated
    await this.revisionRepository.save(revision);

    return { id: revision.id };
  }
}
