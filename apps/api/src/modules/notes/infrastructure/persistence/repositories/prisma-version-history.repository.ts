import { Injectable } from '@nestjs/common';
import type { IVersionHistoryRepository } from '@modules/notes/application/ports/repositories/version-history.repository.port';
import { VersionHistory } from '@modules/notes/domain/entities/version-history.entity';
import { NoteRevisionEntity } from '@modules/notes/domain/entities/note-revision.entity';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';

@Injectable()
export class PrismaVersionHistoryRepository implements IVersionHistoryRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async findByNoteId(noteId: string): Promise<VersionHistory> {
    const rows = await this.prisma.noteRevision.findMany({
      where: { noteId },
      orderBy: { targetSeq: 'asc' },
    });

    const revisions = rows.map((row) => NoteRevisionEntity.create({
      id: row.id,
      noteId: row.noteId,
      targetSeq: row.targetSeq,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      label: row.label,
    }));

    return VersionHistory.load(noteId, revisions);
  }

  async save(history: VersionHistory): Promise<void> {
    // We only need to insert new revisions that don't exist yet, 
    // or we can use upsert for the whole collection. 
    // Since revisions are append-only mostly, let's use transaction with upsert.
    
    const upserts = history.revisions.map((rev) => 
      this.prisma.noteRevision.upsert({
        where: { id: rev.id },
        update: {
          label: rev.label,
        },
        create: {
          id: rev.id,
          noteId: rev.noteId,
          targetSeq: rev.targetSeq,
          createdAt: rev.createdAt,
          createdBy: rev.createdBy,
          label: rev.label,
        },
      })
    );

    await Promise.all(upserts);
  }
}
