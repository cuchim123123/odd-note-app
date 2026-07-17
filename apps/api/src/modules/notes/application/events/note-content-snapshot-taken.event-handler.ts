import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { NoteContentSnapshotTakenEvent } from '@modules/notes/application/events/note-content-snapshot-taken.event';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '@modules/notes/application/ports/note-revision.repository.port';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';

@EventsHandler(NoteContentSnapshotTakenEvent)
export class NoteContentSnapshotTakenEventHandler implements IEventHandler<NoteContentSnapshotTakenEvent> {
  private readonly logger = new Logger(NoteContentSnapshotTakenEventHandler.name);
  // Retention cap: keep max 100 revisions per note to prevent unlimited DB growth.
  private readonly MAX_REVISIONS_PER_NOTE = 100;

  constructor(
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async handle(event: NoteContentSnapshotTakenEvent): Promise<void> {
    const { noteId, title, content, createdBy, label } = event;

    // I-2: Dedup check. If the content and title haven't changed since the
    // latest snapshot, skip creating a new revision.
    const latestRevision = await this.revisionRepository.findLatest(noteId);
    if (latestRevision && latestRevision.title === title && latestRevision.content === content) {
      this.logger.debug(`Skipping revision creation for note ${noteId} — no content changes`);
      return;
    }

    const revisionNumber = latestRevision ? latestRevision.revisionNumber + 1 : 1;

    const revision = NoteRevisionEntity.create({
      id: uuidv7(),
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
