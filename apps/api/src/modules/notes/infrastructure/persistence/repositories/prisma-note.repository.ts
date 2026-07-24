import { Injectable, Inject, Optional } from '@nestjs/common';
import type { INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';
import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteMapper } from '@modules/notes/infrastructure/persistence/mappers/note.mapper';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient, @Optional() @Inject('AGGREGATE_TRACKER') private readonly tracker?: AggregateTracker) {}

  async save(note: NoteEntity): Promise<void> {
    if (this.tracker) {
      this.tracker.track(note);
    }
    const data = NoteMapper.toPersistence(note);

    await this.prisma.note.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        userId: data.userId,
        title: data.title,
        content: null, // Content managed by Yjs / IDocumentSyncPort
        isShared: data.isShared,
        createdAt: note.createdAt,
        updatedAt: data.updatedAt,
      },
      update: {
        title: data.title,
        isShared: data.isShared,
        updatedAt: data.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<NoteEntity | null> {
    const record = await this.prisma.note.findUnique({
      where: { id },
      include: {
        shares: {
          select: {
            id: true,
            recipientId: true,
            recipientEmail: true,
            permission: true,
          },
        },
        protection: {
          select: { id: true },
        },
      },
    });

    if (!record) return null;

    return NoteMapper.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.noteProtection.deleteMany({ where: { noteId: id } });
    await this.prisma.userNoteLabel.deleteMany({ where: { noteId: id } });
    await this.prisma.userNotePin.deleteMany({ where: { noteId: id } });
    await this.prisma.noteShare.deleteMany({ where: { noteId: id } });
    await this.prisma.note.delete({ where: { id } });
  }
}
