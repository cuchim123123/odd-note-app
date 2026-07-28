import { Injectable, Inject } from '@nestjs/common';
import type { INoteRevisionRepository } from '@modules/notes/application/ports/repositories/note-revision.repository.port';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';

@Injectable()
export class PrismaNoteRevisionRepository implements INoteRevisionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  async save(revision: NoteRevisionEntity): Promise<void> {
    await this.prisma.noteRevision.create({
      data: {
        id: revision.id,
        noteId: revision.noteId,
        targetSeq: revision.targetSeq,
        createdAt: revision.createdAt,
        createdBy: revision.createdBy,
        label: revision.label,
      },
    });
  }

  async findById(revisionId: string): Promise<NoteRevisionEntity | null> {
    const row = await this.prisma.noteRevision.findUnique({
      where: { id: revisionId },
    });
    if (!row) return null;
    return NoteRevisionEntity.create(row);
  }

  async findByTargetSeq(noteId: string, targetSeq: bigint): Promise<NoteRevisionEntity | null> {
    const row = await this.prisma.noteRevision.findUnique({
      where: { noteId_targetSeq: { noteId, targetSeq } },
    });
    if (!row) return null;
    return NoteRevisionEntity.create(row);
  }

  async findManyByNoteId(noteId: string, limit: number = 50): Promise<NoteRevisionEntity[]> {
    const rows = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => NoteRevisionEntity.create(row));
  }
}
