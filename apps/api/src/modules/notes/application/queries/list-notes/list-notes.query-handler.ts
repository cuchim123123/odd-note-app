import { QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListNotesQuery } from '@modules/notes/application/queries/list-notes/list-notes.query';
import { DOCUMENT_SYNC_PORT, type IDocumentSyncPort } from '@modules/notes/application/ports/document-sync.port';
import type { NoteResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

/**
 * Query handler: bypass domain and repository, query DB directly for read performance.
 * Per reference architecture: "In read model we can bypass domain and repository layers completely."
 */
@QueryHandler(ListNotesQuery)
export class ListNotesQueryHandler implements IQueryHandler<ListNotesQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_SYNC_PORT)
    private readonly documentSyncPort: IDocumentSyncPort,
  ) {}

  async execute(query: ListNotesQuery): Promise<NoteResponseDto[]> {
    const { userId } = query;

    const notes = await this.prisma.note.findMany({
      where: { userId },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    const noteIds = notes.map(n => n.id);

    // Batch-fetch personal user preferences (labels, pins)
    const [labelsRecords, pinsRecords] = await Promise.all([
      this.prisma.userNoteLabel.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, labels: true } }),
      this.prisma.userNotePin.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, isPinned: true } }),
    ]);

    const labelsMap = Object.fromEntries(labelsRecords.map(r => [r.noteId, r.labels]));
    const pinsMap = Object.fromEntries(pinsRecords.map(r => [r.noteId, r.isPinned]));

    // Enrich with personal data + sort (pinned first, then by updatedAt desc)
    const enriched = notes
      .map(note => ({
        ...note,
        isPinned: pinsMap[note.id] ?? false,
        labels: labelsMap[note.id] ?? [],
      }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    // Resolve content from Yjs/Redis for each note
    return Promise.all(
      enriched.map(async (note) => {
        const content = await this.documentSyncPort.readContent(note.id);
        return {
          id: note.id,
          title: note.title,
          content: content ?? note.content ?? '',
          isPinned: note.isPinned,
          isProtected: Boolean(note.protection),
          isShared: note.isShared || note.shares.length > 0,
          labels: note.labels,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          accessMode: 'owner' as const,
        };
      }),
    );
  }
}
