import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateNoteCommand } from '@modules/notes/application/commands/create-note/create-note.command';
import { NOTE_UNIT_OF_WORK, type INoteUnitOfWork } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import * as Y from 'yjs';
import { DOCUMENT_UPDATE_STORE, type IDocumentUpdateStore } from '@modules/notes/application/ports/stores/document-update.store.port';

import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';

@CommandHandler(CreateNoteCommand)
export class CreateNoteHandler implements ICommandHandler<CreateNoteCommand> {
  constructor(
    @Inject(NOTE_UNIT_OF_WORK)
    private readonly unitOfWork: INoteUnitOfWork,
    @Inject(DOCUMENT_UPDATE_STORE)
    private readonly documentUpdateStore: IDocumentUpdateStore,
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
    });

    // Save initial content to durable event log (Yjs) if provided.
    if (command.content) {
      try {
        const ydoc = new Y.Doc();
        const xml = ydoc.getXmlFragment('prosemirror');
        const paragraph = new Y.XmlElement('paragraph');
        paragraph.insert(0, [new Y.XmlText(command.content)]);
        xml.insert(0, [paragraph]);
        
        const updateBlob = Y.encodeStateAsUpdate(ydoc);
        
        await this.documentUpdateStore.append({
          noteId: note.id,
          authorId: command.userId,
          updateBlob,
          sizeBytes: updateBlob.length,
          createdAt: note.createdAt,
        });
      } catch (error) {
        // Log the error but don't fail the request. The Note exists in SQL.
        // A retry mechanism or background sync can recover this later.
        console.error(`[CreateNoteHandler] Failed to persist initial Yjs snapshot to Postgres for note ${note.id}`, error);
      }
    }

    // Removed draft cache invalidation as it is deprecated
    return { id: note.id };
  }
}
