import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotesProtectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getProtectionStatus(userId: string, noteId: string): Promise<{ isProtected: boolean }> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId } },
      select: { id: true },
    });

    return { isProtected: Boolean(protection) };
  }

  async setPassword(userId: string, noteId: string, password: string): Promise<{ isProtected: true }> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.noteProtection.upsert({
      where: { userId_noteId: { userId, noteId } },
      update: { passwordHash },
      create: { userId, noteId, passwordHash },
    });

    return { isProtected: true };
  }

  async verifyPassword(userId: string, noteId: string, password: string): Promise<{ verified: boolean }> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId } },
    });

    if (!protection) {
      return { verified: false };
    }

    return { verified: await bcrypt.compare(password, protection.passwordHash) };
  }

  async removePassword(userId: string, noteId: string, password: string): Promise<{ removed: true }> {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });

    if (!note || note.userId !== userId) {
      throw new UnauthorizedException('Only the note owner can remove password protection');
    }

    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId, noteId } },
    });

    if (!protection) {
      throw new UnauthorizedException('No protection is set for this note');
    }

    const isValid = await bcrypt.compare(password, protection.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.prisma.noteProtection.delete({
      where: { userId_noteId: { userId, noteId } },
    });

    return { removed: true };
  }

  private async notifyCollaborationChange(noteId: string, type: 'permissions_updated' | 'note_deleted'): Promise<void> {
    try {
      await this.redis.getClient().publish('collaboration:events', JSON.stringify({ type, noteId }));
    } catch (err) {
      console.error('Failed to publish collaboration event', err);
    }
  }
}
