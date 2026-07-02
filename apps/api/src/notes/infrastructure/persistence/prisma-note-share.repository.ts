import { Injectable, Inject } from '@nestjs/common';
import type {
  INoteShareRepository,
  NoteShareCreateData,
  NoteShareRecord,
} from '../../application/ports/note-share.repository.port';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PrismaTransactionClient } from './prisma-client.type';
import { SharePermission } from '@prisma/client';

/**
 * Infrastructure adapter: manages NoteShare DB records.
 * Note aggregate owns the in-memory share list; this adapter is the persistence
 * representation of those share relationships.
 */
@Injectable()
export class PrismaNoteShareRepository implements INoteShareRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  async create(data: NoteShareCreateData): Promise<NoteShareRecord> {
    return this.prisma.noteShare.create({
      data: {
        noteId: data.noteId,
        ownerId: data.ownerId,
        recipientId: data.recipientId,
        recipientEmail: data.recipientEmail,
        permission: data.permission as SharePermission,
      },
      select: { id: true },
    });
  }

  async updatePermission(shareId: string, permission: string): Promise<NoteShareRecord> {
    return this.prisma.noteShare.update({
      where: { id: shareId },
      data: { permission: permission as SharePermission },
      select: { id: true },
    });
  }

  async delete(shareId: string): Promise<void> {
    await this.prisma.noteShare.delete({ where: { id: shareId } });
  }
}



