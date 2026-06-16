import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateNoteCommand } from './update-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    private readonly prisma: PrismaService, // Still needed for pin/label — personal user data outside the Note aggregate
  ) {}

  async execute(command: UpdateNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, title, content, isPinned, labels } = command;

    // Load aggregate — enforces existence check
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Domain invariant: canEdit() checks owner OR EDIT share permission
    if (!note.canEdit(userId)) {
      // canEdit() uses the aggregate's in-memory share list
      throw new NotFoundException('Note not found or you do not have permission to edit it');
    }

    // Mutate aggregate — value objects enforce title constraints
    if (title !== undefined) {
      note.rename(NoteTitle.create(title), userId);
    }

    // Persist aggregate state
    await this.noteRepository.save(note);

    // Personal user data (pin/labels) are outside the Note aggregate — they're user preferences
    let personalIsPinned = false;
    if (isPinned !== undefined) {
      const upsertedPin = await this.prisma.userNotePin.upsert({
        where: { userId_noteId: { userId, noteId } },
        create: { userId, noteId, isPinned },
        update: { isPinned },
      });
      personalIsPinned = upsertedPin.isPinned;
    } else {
      const existingPin = await this.prisma.userNotePin.findUnique({
        where: { userId_noteId: { userId, noteId } },
      });
      personalIsPinned = existingPin?.isPinned ?? false;
    }

    if (labels !== undefined) {
      await this.prisma.userNoteLabel.upsert({
        where: { userId_noteId: { userId, noteId } },
        create: { userId, noteId, labels },
        update: { labels },
      });
    }

    // Sync document state (Yjs / Redis)
    if (content !== undefined) {
      await this.documentSyncPort.persistSnapshot(
        noteId,
        note.title,
        content,
        personalIsPinned,
        note.updatedAt,
      );
    }

    return { id: note.id };
  }
}
