import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateRevisionCommand } from '@modules/notes/application/commands/create-revision/create-revision.command';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '@modules/notes/application/ports/note-revision.repository.port';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

@CommandHandler(CreateRevisionCommand)
export class CreateRevisionHandler implements ICommandHandler<CreateRevisionCommand> {
  private readonly logger = new Logger(CreateRevisionHandler.name);
  // Retention cap: keep max 100 revisions per note to prevent unlimited DB growth.
  private readonly MAX_REVISIONS_PER_NOTE = 100;

  constructor(
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async execute(command: CreateRevisionCommand): Promise<void> {
    const { noteId, title, content, createdBy, label } = command;

    // I-2: Dedup check. If the content and title haven't changed since the
    // latest snapshot, skip creating a new revision.
    const latestRevision = await this.revisionRepository.findLatest(noteId);
    if (latestRevision && latestRevision.title === title && latestRevision.content === content) {
      this.logger.debug(`Skipping revision creation for note ${noteId} — no content changes`);
      return;
    }

    const revisionNumber = latestRevision ? latestRevision.revisionNumber + 1 : 1;

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

    // I-2: Prune oldest revisions if we exceeded the retention cap.
    await this.revisionRepository.pruneOldest(noteId, this.MAX_REVISIONS_PER_NOTE);
  }
}
