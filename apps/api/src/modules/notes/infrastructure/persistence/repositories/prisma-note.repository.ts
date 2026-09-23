import { Injectable, Inject, Optional } from '@nestjs/common';
import type { INoteRepository } from '@modules/notes/application/ports/repositories/note.repository.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SharePermission as PrismaSharePermission } from '@prisma/client';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';
import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import { NoteMapper } from '@modules/notes/infrastructure/persistence/mappers/note.mapper';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient, @Optional() @Inject('AGGREGATE_TRACKER') private readonly tracker?: AggregateTracker) {}

  async create(note: NoteEntity): Promise<void> {
    const data = NoteMapper.toPersistence(note);

    await this.prisma.note.create({
      data: {
        id: data.id,
        userId: data.userId,
        title: data.title,
        content: null, // Content managed by Yjs / IDocumentSyncPort
        isShared: data.isShared,
        aiTags: data.aiTags,
        rejectedAiTags: data.rejectedAiTags,
        aiTagsSeq: data.aiTagsSeq,
        createdAt: note.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async update(note: NoteEntity): Promise<void> {
    const data = NoteMapper.toPersistence(note);

    const currentShareIds = data.shares.map((s) => s.id);

    await this.prisma.note.update({
      where: { id: data.id },
      data: {
        title: data.title,
        isShared: data.isShared,
        aiTags: data.aiTags,
        rejectedAiTags: data.rejectedAiTags,
        aiTagsSeq: data.aiTagsSeq,
        updatedAt: data.updatedAt,
        shares: {
          deleteMany: {
            id: { notIn: currentShareIds },
          },
          upsert: data.shares.map((s) => ({
            where: { id: s.id },
            update: { permission: s.permission as PrismaSharePermission },
            create: {
              id: s.id,
              ownerId: data.userId,
              recipientId: s.recipientId,
              recipientEmail: s.recipientEmail,
              permission: s.permission as PrismaSharePermission,
            },
          })),
        },
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

  async delete(note: NoteEntity): Promise<void> {
    const id = note.id;
    await this.prisma.noteProtection.deleteMany({ where: { noteId: id } });
    await this.prisma.userNoteLabel.deleteMany({ where: { noteId: id } });
    await this.prisma.userNotePin.deleteMany({ where: { noteId: id } });
    await this.prisma.noteShare.deleteMany({ where: { noteId: id } });
    await this.prisma.note.delete({ where: { id } });
  }
}
