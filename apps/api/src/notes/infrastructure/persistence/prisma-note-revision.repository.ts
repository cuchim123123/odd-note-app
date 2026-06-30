import { Injectable } from '@nestjs/common';
import type { INoteRevisionRepository } from '../../application/ports/note-revision.repository.port';
import { NoteRevisionEntity } from '../../domain/entities/note-revision.entity';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PrismaNoteRevisionRepository implements INoteRevisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nextRevisionNumber(noteId: string): Promise<number> {
    const result = await this.prisma.noteRevision.aggregate({
      where: { noteId },
      _max: { revisionNumber: true },
    });
    return (result._max.revisionNumber ?? 0) + 1;
  }

  async save(revision: NoteRevisionEntity): Promise<void> {
    await this.prisma.noteRevision.create({
      data: {
        id: revision.id,
        noteId: revision.noteId,
        revisionNumber: revision.revisionNumber,
        title: revision.title,
        content: revision.content,
        createdAt: revision.createdAt,
        createdBy: revision.createdBy,
        label: revision.label,
      },
    });
  }

  async findByNoteId(noteId: string): Promise<Omit<NoteRevisionEntity, 'content'>[]> {
    const rows = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { revisionNumber: 'desc' },
      select: {
        id: true,
        noteId: true,
        revisionNumber: true,
        title: true,
        createdAt: true,
        createdBy: true,
        label: true,
      },
    });
    return rows.map((r) =>
      NoteRevisionEntity.create({ ...r, content: '' }),
    );
  }

  async findById(revisionId: string): Promise<NoteRevisionEntity | null> {
    const row = await this.prisma.noteRevision.findUnique({
      where: { id: revisionId },
    });
    if (!row) return null;
    return NoteRevisionEntity.create(row);
  }
}
