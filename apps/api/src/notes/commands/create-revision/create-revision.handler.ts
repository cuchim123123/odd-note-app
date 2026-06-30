import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateRevisionCommand } from './create-revision.command';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '../../application/ports/note-revision.repository.port';
import { NoteRevisionEntity } from '../../domain/entities/note-revision.entity';

@CommandHandler(CreateRevisionCommand)
export class CreateRevisionHandler implements ICommandHandler<CreateRevisionCommand> {
  constructor(
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async execute(command: CreateRevisionCommand): Promise<void> {
    const { noteId, title, content, createdBy, label } = command;

    const revisionNumber = await this.revisionRepository.nextRevisionNumber(noteId);

    const revision = NoteRevisionEntity.create({
      id: randomUUID(),
      noteId,
      revisionNumber,
      title,
      content,
      createdAt: new Date(),
      createdBy,
      label: label ?? 'Auto-save',
    });

    await this.revisionRepository.save(revision);
  }
}
