/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListSharedWithMeQuery } from './list-shared-with-me.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '../../ports/document-sync.port';
import type { SharedNoteResponseDto } from '../../../presentation/http/dto/note.response.dto';
import { PrismaService } from '../../../../../infrastructure/prisma/prisma.service';

@QueryHandler(ListSharedWithMeQuery)
export class ListSharedWithMeQueryHandler implements IQueryHandler<ListSharedWithMeQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(query: ListSharedWithMeQuery): Promise<SharedNoteResponseDto[]> {
    const { userId } = query;

    const sharedNotes = await this.prisma.noteShare.findMany({
      where: { recipientId: userId },
      include: {
        owner: { select: { id: true, email: true, displayName: true } },
        note: {
          include: {
            shares: { select: { id: true } },
            protection: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const noteIds = sharedNotes.map((s) => s.note.id);
    const [labelsRecords, pinsRecords] = await Promise.all([
      this.prisma.userNoteLabel.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, labels: true } }),
      this.prisma.userNotePin.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, isPinned: true } }),
    ]);

    const labelsMap = Object.fromEntries(labelsRecords.map((r: any) => [r.noteId, r.labels]));
    const pinsMap = Object.fromEntries(pinsRecords.map((r: any) => [r.noteId, r.isPinned]));

    const enriched = sharedNotes
      .map((share: any) => ({
        ...share,
        note: {
          ...share.note,
          isPinned: pinsMap[share.note.id] ?? false,
          labels: labelsMap[share.note.id] ?? [],
        },
      }))
      .sort((a: any, b: any) => {
        if (a.note.isPinned !== b.note.isPinned) return a.note.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return Promise.all(
      enriched.map(async (share) => {
        const content = await this.documentSyncPort.readContent(share.note.id);
        return {
          id: share.note.id,
          title: share.note.title,
          content: content ?? share.note.content ?? '',
          isPinned: share.note.isPinned,
          isProtected: Boolean(share.note.protection),
          isShared: true,
          labels: share.note.labels,
          createdAt: share.note.createdAt.toISOString(),
          updatedAt: share.note.updatedAt.toISOString(),
          accessMode: 'shared' as const,
          sharedPermission: share.permission as 'READ' | 'EDIT',
          sharedBy: share.owner,
          sharedAt: share.createdAt.toISOString(),
        };
      }),
    );
  }
}
