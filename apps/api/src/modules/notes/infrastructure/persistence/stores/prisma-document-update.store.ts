import { Injectable, Inject } from '@nestjs/common';
import type { IDocumentUpdateStore, AppendDocumentUpdateDto, StoredDocumentUpdate } from '@modules/notes/application/ports/stores/document-update.store.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaDocumentUpdateStore implements IDocumentUpdateStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async append(update: AppendDocumentUpdateDto): Promise<StoredDocumentUpdate> {
    const row = await this.prisma.noteUpdate.create({
      data: {
        noteId: update.noteId,
        authorId: update.authorId,
        updateBlob: Buffer.from(update.updateBlob),
        sizeBytes: update.sizeBytes,
        createdAt: update.createdAt,
      },
    });

    return {
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    };
  }

  async getUpdatesInRange(noteId: string, fromSeqExclusive: bigint, toSeqInclusive: bigint): Promise<StoredDocumentUpdate[]> {
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

    return rows.map((row) => ({
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    }));
  }

  async getUpdatesSince(noteId: string, fromSeqExclusive: bigint): Promise<StoredDocumentUpdate[]> {
    const rows = await this.prisma.noteUpdate.findMany({
      where: {
        noteId,
        seq: { gt: fromSeqExclusive },
      },
      orderBy: { seq: 'asc' },
    });

    return rows.map((row) => ({
      seq: row.seq,
      noteId: row.noteId,
      updateBlob: new Uint8Array(row.updateBlob),
      sizeBytes: row.sizeBytes,
      authorId: row.authorId,
      createdAt: row.createdAt,
    }));
  }
}
