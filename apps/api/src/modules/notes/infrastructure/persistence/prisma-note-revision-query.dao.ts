import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteRevisionQueryDao } from '@modules/notes/application/ports/note-revision-query.dao.port';
import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';

@Injectable()
export class PrismaNoteRevisionQueryDao implements INoteRevisionQueryDao {
  constructor(private readonly prisma: PrismaService) {}

  async findByNoteId(noteId: string): Promise<NoteRevisionSummaryDto[]> {
    const revisions = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetSeq: true,
        createdAt: true,
        createdBy: true,
        label: true,
      },
    });

    return revisions.map((r) => ({
      id: r.id,
      targetSeq: r.targetSeq.toString(),
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
      label: r.label,
    }));
  }
}
