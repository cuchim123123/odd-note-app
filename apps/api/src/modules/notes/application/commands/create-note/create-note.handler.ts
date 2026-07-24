import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from '@modules/notes/application/commands/create-note/create-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/repositories/unit-of-work.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/services/document-sync.port';

import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(command: CreateNoteCommand): Promise<{ id: string }> {
    const title = NoteTitle.create(command.title);

    // Create Note aggregate root
    const note = NoteEntity.create(command.userId, title, command.id);

    await this.unitOfWork.execute(async (ctx) => {
      // Save aggregate
      await ctx.noteRepository.save(note);
      
      // Dispatch domain events while inside the UOW

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

    // Removed draft cache invalidation as it is deprecated
    return { id: note.id };
  }
}
