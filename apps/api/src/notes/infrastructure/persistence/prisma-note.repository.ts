import { Injectable } from '@nestjs/common';
import type { INoteRepository } from '../../application/ports/note.repository.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { NoteEntity } from '../../domain/entities/note.entity';

@Injectable()
export class PrismaNoteRepository implements INoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(note: NoteEntity): Promise<void> {
    await this.prisma.note.upsert({
      where: { id: note.id },
      create: {
        id: note.id,
        userId: note.ownerId,
        title: note.title,
        content: null, // content is handled by yjs
        isShared: note.isShared,
        labels: [], // handled separately for now
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
      update: {
        title: note.title,
        isShared: note.isShared,
        updatedAt: note.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<NoteEntity | null> {
    // Basic implementation for now
    const record = await this.prisma.note.findUnique({ where: { id } });
    if (!record) return null;
    
    // Note: Reconstituting the full entity would require pulling shares, etc.
    // For this stub, returning null to force focus on CQRS
    return null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.note.delete({ where: { id } });
  }
}
