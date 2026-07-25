import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteAccessPort, NoteAccessView } from '@modules/notes/application/ports/security/note-access.port';

/**
 * Prisma-backed adapter for INoteAccessPort.
 * Reads authorization state directly from PostgreSQL — never from an
 * eventually-consistent store. This adapter must remain on Prisma permanently.
 */
@Injectable()
export class PrismaNoteAccessAdapter implements INoteAccessPort {
  constructor(private readonly prisma: PrismaService) {}

  async checkAccess(noteId: string, userId: string): Promise<NoteAccessView | null> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: {
        userId: true,
        shares: { where: { recipientId: userId }, select: { permission: true } },
      },
    });

    if (!note) return null;

    const isOwner = note.userId === userId;
    const share = note.shares[0];
    const permission = isOwner ? 'EDIT' : (share?.permission as 'READ' | 'EDIT' | undefined);

    const result: NoteAccessView = {
      hasAccess: true,
      isOwner,
      ownerId: note.userId,
    };

    if (permission) {
      result.permission = permission;
    }

    return result;
  }

  async isProtected(noteId: string, ownerId: string): Promise<boolean> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: ownerId, noteId } },
      select: { id: true },
    });
    return Boolean(protection);
  }
}
