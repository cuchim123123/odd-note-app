import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UpdateNoteCommand } from './update-note.command';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../application/ports/document-sync.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(UpdateNoteCommand)
export class UpdateNoteHandler implements ICommandHandler<UpdateNoteCommand> {
  constructor(
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    private readonly prisma: PrismaService, // Temporary until full UoW
  ) {}

  async execute(command: UpdateNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, title, content, isPinned, isShared, labels } = command;

    const existing = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
      },
    });

    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    const isOwner = existing.userId === userId;
    if (!isOwner) {
      const editShare = await this.prisma.noteShare.findFirst({
        where: { noteId, recipientId: userId, permission: 'EDIT' },
      });

      if (!editShare) {
        throw new UnauthorizedException('You do not have permission to edit this note');
      }
    }

    const updatedNote = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        title: title?.trim() ?? existing.title,
        content: content ?? existing.content,
        isShared: isShared ?? existing.isShared,
      },
    });

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

    await this.documentSyncPort.persistSnapshot(
      updatedNote.id,
      updatedNote.title,
      updatedNote.content,
      personalIsPinned,
      updatedNote.updatedAt,
    );

    return { id: updatedNote.id };
  }
}
