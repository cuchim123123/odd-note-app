import { Injectable, Inject } from '@nestjs/common';
import type { INoteRevisionRepository } from '../../application/ports/note-revision.repository.port';
import { NoteRevisionEntity } from '../../domain/entities/note-revision.entity';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from './prisma-client.type';

@Injectable()
export class PrismaNoteRevisionRepository implements INoteRevisionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

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

  async findLatest(noteId: string): Promise<NoteRevisionEntity | null> {
    const row = await this.prisma.noteRevision.findFirst({
      where: { noteId },
      orderBy: { revisionNumber: 'desc' },
    });
    if (!row) return null;
    return NoteRevisionEntity.create(row);
  }

  /**
   * Keeps the newest `keepCount` revisions and deletes anything older.
   * Uses a sub-select to identify the IDs to delete without loading them
   * into memory — efficient even for large revision histories.
   */
  async pruneOldest(noteId: string, keepCount: number): Promise<void> {
    // Find the revision numbers to keep (newest N)
    const toKeep = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { revisionNumber: 'desc' },
      take: keepCount,
      select: { id: true },
    });

    if (toKeep.length < keepCount) return; // not yet at cap

    await this.prisma.noteRevision.deleteMany({
      where: {
        noteId,
        id: { notIn: toKeep.map((r) => r.id) },
      },
    });
  }
}



