import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from './create-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '../../application/ports/draft-cache.port';
import { USER_PREFERENCES_REPOSITORY, type IUserPreferencesRepository } from '../../application/ports/user-preferences.repository.port';
import { NoteEntity } from '../../domain/entities/note.entity';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    @Inject(USER_PREFERENCES_REPOSITORY)
    private readonly userPreferencesRepository: IUserPreferencesRepository,
  ) {}

  async execute(command: CreateNoteCommand): Promise<{ id: string }> {
    const title = NoteTitle.create(command.title);

    // Create Note aggregate root
    const note = NoteEntity.create(command.userId, title);

    // Save aggregate
    await this.noteRepository.save(note);

    // Save initial content to document sync port (Yjs) if provided
    if (command.content) {
      await this.documentSyncPort.persistSnapshot(
        note.id,
        note.title,
        command.content,
        false,
        note.updatedAt,
      );
    }

    // Labels are user-scoped personal data — persisted via preferences port
    if (command.labels && command.labels.length > 0) {
      await this.userPreferencesRepository.createLabel(command.userId, note.id, command.labels);
    }

    // Clear any draft that may have existed for 'new' note
    await this.draftCachePort.clearDraft(command.userId, 'new');

    return { id: note.id };
  }
}
