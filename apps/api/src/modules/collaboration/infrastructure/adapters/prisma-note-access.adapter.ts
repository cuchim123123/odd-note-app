import { Injectable, Inject } from '@nestjs/common';
import type { INoteAccessPort } from '@modules/collaboration/application/ports/note-access.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { NOTE_PROTECTION_PORT } from '@modules/notes/application/ports/note-protection.port';
import type { INoteProtectionPort } from '@modules/notes/application/ports/note-protection.port';

@Injectable()
export class PrismaNoteAccessAdapter implements INoteAccessPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async canAccessNote(userId: string, noteId: string, unlockToken?: string): Promise<boolean> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) return false;

    // Check if protected
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId } },
      select: { id: true },
    });

    if (protection) {
      const isUnlocked = await this.protectionPort.verifyUnlockToken(userId, noteId, unlockToken);
      if (!isUnlocked) return false;
    }

    return true;
  }

  async getAccessPermissions(userId: string, noteId: string): Promise<{ isOwner: boolean; canEdit: boolean } | null> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      include: {
        shares: {
          where: { recipientId: userId },
        },
      },
    });

    if (!note) return null;

    if (note.userId === userId) {
      return { isOwner: true, canEdit: true };
    }

    const share = note.shares[0];
    if (share) {
      return { isOwner: false, canEdit: share.permission === 'EDIT' };
    }

    return null;
  }
}
