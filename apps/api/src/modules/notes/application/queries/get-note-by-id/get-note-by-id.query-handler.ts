import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { NoteNotFoundError } from '../../../domain/errors/note.errors';
import { GetNoteByIdQuery } from './get-note-by-id.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../ports/document-sync.port';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../ports/note-protection.port';
import type { NoteResponseDto } from '../../../presentation/http/dto/note.response.dto';
import { PrismaService } from '../../../../../prisma/prisma.service';

@QueryHandler(GetNoteByIdQuery)
export class GetNoteByIdQueryHandler implements IQueryHandler<GetNoteByIdQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(query: GetNoteByIdQuery): Promise<NoteResponseDto> {
    const { userId, noteId, unlockToken } = query;

    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    if (!note) throw new NoteNotFoundError(noteId);

    // Check if this is a shared access (not owner)
    const sharedAccess = note.userId !== userId
      ? await this.prisma.noteShare.findFirst({
          where: { noteId, recipientId: userId },
          include: { owner: { select: { id: true, email: true, displayName: true } } },
        })
      : null;

    const [labelsRecord, pinRecord] = await Promise.all([
      this.prisma.userNoteLabel.findUnique({ where: { userId_noteId: { userId, noteId } }, select: { labels: true } }),
      this.prisma.userNotePin.findUnique({ where: { userId_noteId: { userId, noteId } }, select: { isPinned: true } }),
    ]);

    const isProtected = Boolean(note.protection);
    let content = await this.documentSyncPort.readContent(noteId) ?? note.content ?? '';

    // Server-side content gate: blank content if protected and unlockToken is invalid
    if (isProtected) {
      const isUnlocked = await this.protectionPort.verifyUnlockToken(userId, noteId, unlockToken);
      if (!isUnlocked) content = '';
    }

    return {
      id: note.id,
      title: note.title,
      content,
      isPinned: pinRecord?.isPinned ?? false,
      isProtected,
      isShared: note.isShared || note.shares.length > 0,
      labels: labelsRecord?.labels ?? [],
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      accessMode: sharedAccess ? 'shared' : 'owner',
      sharedPermission: sharedAccess ? (sharedAccess.permission as 'READ' | 'EDIT') : undefined,
      sharedBy: sharedAccess?.owner ?? undefined,
      sharedAt: sharedAccess?.createdAt.toISOString() ?? undefined,
    };
  }
}
