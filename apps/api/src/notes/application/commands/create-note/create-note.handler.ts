import { CommandHandler, type ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from './create-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '../../ports/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../ports/document-sync.port';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '../../ports/draft-cache.port';
import { NoteEntity } from '../../../domain/entities/note.entity';
import { NoteTitle } from '../../../domain/value-objects/note-title.vo';
import { dispatchDomainEvents } from '../../../../common/ddd';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateNoteCommand): Promise<{ id: string }> {
    const title = NoteTitle.create(command.title);

    // Create Note aggregate root
    const note = NoteEntity.create(command.userId, title);

    await this.unitOfWork.execute(async (ctx) => {
      // Save aggregate
      await ctx.noteRepository.save(note);
      
      // Dispatch domain events while inside the UOW
      await dispatchDomainEvents(note, this.eventBus);

      // Labels are user-scoped personal data — persisted via preferences port
      if (command.labels && command.labels.length > 0) {
        await ctx.userPreferencesRepository.createLabel(command.userId, note.id, command.labels);
      }
    });

    // Save initial content to document sync port (Yjs) if provided.
    // Document sync relies on Redis, so we keep it outside the SQL UOW.
    if (command.content) {
      await this.documentSyncPort.persistSnapshot(
        note.id,
        note.title,
        command.content,
        false,
        note.updatedAt,
      );
    }

    // Clear any draft that may have existed for 'new' note
    // Cache invalidation also belongs outside the SQL UOW.
    await this.draftCachePort.clearDraft(command.userId, 'new');

    return { id: note.id };
  }
}
