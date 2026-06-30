import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetNoteHistoryQuery } from './get-note-history.query';
import { NOTE_REVISION_REPOSITORY, type INoteRevisionRepository } from '../../application/ports/note-revision.repository.port';
import { NotePermissionDeniedError, NoteNotFoundError } from '../../domain/errors/note.errors';

export interface NoteRevisionSummaryDto {
  id: string;
  revisionNumber: number;
  title: string;
  createdAt: string;
  createdBy: string;
  label: string | null;
}

@QueryHandler(GetNoteHistoryQuery)
export class GetNoteHistoryQueryHandler implements IQueryHandler<GetNoteHistoryQuery> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTE_REVISION_REPOSITORY)
    private readonly revisionRepository: INoteRevisionRepository,
  ) {}

  async execute(query: GetNoteHistoryQuery): Promise<NoteRevisionSummaryDto[]> {
    const { userId, noteId } = query;

    // Verify the note exists and the user has access (owner or shared)
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { id: true },
    });

    if (!note) throw new NoteNotFoundError(noteId);

    // Only the owner can view version history (shared editors cannot)
    const isOwner = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      select: { id: true },
    });

    if (!isOwner) throw new NotePermissionDeniedError('Only the note owner can view version history');

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
