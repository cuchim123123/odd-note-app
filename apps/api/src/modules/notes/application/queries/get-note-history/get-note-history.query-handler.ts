import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { GetNoteHistoryQuery } from './get-note-history.query';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '../../ports/note-revision.repository.port';
import { NotePermissionDeniedError, NoteNotFoundError } from '../../../domain/errors/note.errors';
import type { NoteRevisionSummaryDto } from '../../../presentation/http/dto/note-revision-summary.dto';

export type { NoteRevisionSummaryDto };

@QueryHandler(GetNoteHistoryQuery)
export class GetNoteHistoryQueryHandler implements IQueryHandler<GetNoteHistoryQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async execute(query: GetNoteHistoryQuery): Promise<NoteRevisionSummaryDto[]> {
    const { userId, noteId } = query;

    /**
     * P-4 fix: single query that selects userId for the ownership check.
     * Previous implementation made two separate findFirst() calls:
     *  1) existence + access (OR[owner, shared])
     *  2) ownership re-check (where: { userId })
     * Both can be collapsed by projecting userId and comparing in-memory.
     */
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) throw new NoteNotFoundError(noteId);
    if (note.userId !== userId) {
      throw new NotePermissionDeniedError('Only the note owner can view version history');
    }

    const revisions = await this.revisionRepository.findByNoteId(noteId);

    return revisions.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
      label: r.label,
    }));
  }
}
