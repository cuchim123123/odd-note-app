import { Injectable } from '@nestjs/common';
import type { INoteRepository } from '../../application/ports/note.repository.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { NoteEntity } from '../../domain/entities/note.entity';
import { NoteMapper } from './note.mapper';

@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(note: NoteEntity): Promise<void> {
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
      },
    });

    if (!record) return null;

    return NoteMapper.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    // Cascade: delete related records first in a transaction
    await this.prisma.$transaction([
      this.prisma.noteProtection.deleteMany({ where: { noteId: id } }),
      this.prisma.userNoteLabel.deleteMany({ where: { noteId: id } }),
      this.prisma.userNotePin.deleteMany({ where: { noteId: id } }),
      this.prisma.noteShare.deleteMany({ where: { noteId: id } }),
      this.prisma.note.delete({ where: { id } }),
    ]);
  }
}
