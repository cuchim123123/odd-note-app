import { Injectable, Inject } from '@nestjs/common';
import type { ISnapshotMetadataRepository } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { NoteSnapshotMetadata } from '@modules/notes/domain/entities/note-snapshot-metadata.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaSnapshotMetadataRepository implements ISnapshotMetadataRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async save(metadata: NoteSnapshotMetadata): Promise<void> {
    await this.prisma.noteSnapshotMetadata.create({
      data: {
        id: metadata.id,
        noteId: metadata.noteId,
        snapshotSeq: metadata.snapshotSeq,
        s3ObjectKey: metadata.s3ObjectKey,
        createdAt: metadata.createdAt,
      },
    });
  }

  async findNearestBefore(noteId: string, targetSeq: bigint): Promise<NoteSnapshotMetadata | null> {
    const row = await this.prisma.noteSnapshotMetadata.findFirst({
      where: {
        noteId,
        snapshotSeq: { lte: targetSeq },
      },
      orderBy: { snapshotSeq: 'desc' },
    });

    if (!row) return null;

    return NoteSnapshotMetadata.create(row);
  }
}
