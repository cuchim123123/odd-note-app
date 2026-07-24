import { Injectable, Inject } from '@nestjs/common';
import type { INoteUpdateRepository } from '@modules/notes/application/ports/repositories/note-update.repository.port';
import { NoteUpdateLog } from '@modules/notes/domain/entities/note-update.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaNoteUpdateRepository implements INoteUpdateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async append(update: Omit<NoteUpdateLog, 'seq'>): Promise<NoteUpdateLog> {
    const row = await this.prisma.noteUpdate.create({
      data: {
        noteId: update.noteId,
        authorId: update.authorId,
        updateBlob: Buffer.from(update.updateBlob),
        sizeBytes: update.sizeBytes,
        createdAt: update.createdAt,
      },
    });

    return NoteUpdateLog.create({
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    });
  }

  async getUpdatesInRange(noteId: string, fromSeqExclusive: bigint, toSeqInclusive: bigint): Promise<NoteUpdateLog[]> {
    const rows = await this.prisma.noteUpdate.findMany({
      where: {
        noteId,
        seq: {
          gt: fromSeqExclusive,
          lte: toSeqInclusive,
        },
      },
      orderBy: { seq: 'asc' },
    });

    return rows.map((row) => NoteUpdateLog.create({
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    }));
  }

  async getUpdatesSince(noteId: string, fromSeqExclusive: bigint): Promise<NoteUpdateLog[]> {
    const rows = await this.prisma.noteUpdate.findMany({
      where: {
        noteId,
        seq: { gt: fromSeqExclusive },
      },
      orderBy: { seq: 'asc' },
    });

    return rows.map((row) => NoteUpdateLog.create({
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    }));
  }
}
