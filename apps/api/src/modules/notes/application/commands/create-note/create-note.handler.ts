import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from '@modules/notes/application/commands/create-note/create-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { DOCUMENT_ENGINE_PORT, type IDocumentEnginePort } from '@modules/notes/application/ports/external/document-engine.port';

import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_ENGINE_PORT)
    private readonly documentEngine: IDocumentEnginePort,
  ) {}

  async execute(command: CreateNoteCommand): Promise<{ id: string }> {
    const title = NoteTitle.create(command.title);

    // Create Note aggregate root
    const note = NoteEntity.create(command.userId, title);

    await this.unitOfWork.execute(async (ctx) => {
      await ctx.repos.note.create(note);
      
      // Dispatch domain events while inside the UOW

      // Labels are user-scoped personal data — persisted via preferences port
      if (command.labels && command.labels.length > 0) {
        await ctx.repos.userPreferences.createLabel(command.userId, note.id, command.labels);
      }

      // Save initial content to durable event log atomically
      if (command.content) {
        const updateBlob = this.documentEngine.createInitialContent(command.content);
        
        await ctx.documentUpdateStore.append({
          noteId: note.id,
          authorId: command.userId,
          updateBlob,
          createdAt: note.createdAt,
        });
      }
    });

    // Removed draft cache invalidation as it is deprecated
    return { id: note.id };
  }
}
