import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from './create-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { DRAFT_CACHE_PORT, type IDraftCachePort } from '../../application/ports/draft-cache.port';
import { NoteEntity } from '../../domain/entities/note.entity';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(DRAFT_CACHE_PORT)
    private readonly draftCachePort: IDraftCachePort,
    private readonly prisma: PrismaService, // Temporary until UoW / Label Repository is fully implemented
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
        false, // not pinned by default
        note.updatedAt
      );
    }

    // Handle labels (Personal aspect, outside of the Note aggregate itself)
    if (command.labels && command.labels.length > 0) {
      await this.prisma.userNoteLabel.create({
        data: {
          userId: command.userId,
          noteId: note.id,
          labels: command.labels,
        },
      });
    }

    // Clear any draft that might have existed
    await this.draftCachePort.clearDraft(command.userId, 'new');

    // Dispatch domain events - handled by Outbox/EventBus (to be implemented via generic repository hook or decorator)
    // For now, NestJS CQRS will require EventBus if we use EventPublisher

    return { id: note.id };
  }
}
