import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import type { INoteRevisionQueryDao } from '@modules/notes/application/ports/note-revision-query.dao.port';
import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';

@Injectable()
export class PrismaNoteRevisionQueryDao implements INoteRevisionQueryDao {
  constructor(private readonly prisma: PrismaService) {}

  async findByNoteId(noteId: string): Promise<NoteRevisionSummaryDto[]> {
    const revisions = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { revisionNumber: 'desc' },
      select: {
        id: true,
        revisionNumber: true,
        title: true,
        createdAt: true,
        createdBy: true,
        label: true,
      },
    });

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
