import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';
import type { INoteProtectionPort } from '@modules/notes/application/ports/external/note-protection.port';

/**
 * Infrastructure adapter for note password protection.
 * Wraps Prisma + bcrypt logic behind the INoteProtectionPort interface.
 * This is the ONLY place in the application where bcrypt operations live.
 */
@Injectable()
export class PrismaNoteProtectionAdapter implements INoteProtectionPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaTransactionClient,
  ) {}

  async setPassword(userId: string, noteId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.noteProtection.upsert({
      where: { userId_noteId: { userId, noteId } },
      update: { passwordHash },
      create: { userId, noteId, passwordHash },
    });
  }

  async verifyPassword(ownerId: string, noteId: string, password: string): Promise<boolean> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: ownerId, noteId } },
    });

    if (!protection) return false;

    return bcrypt.compare(password, protection.passwordHash);
  }

  async removePassword(userId: string, noteId: string): Promise<void> {
    await this.prisma.noteProtection.deleteMany({
      where: { userId, noteId },
    });
  }
}



