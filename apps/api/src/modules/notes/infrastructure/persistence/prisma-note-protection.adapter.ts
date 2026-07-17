import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/prisma-client.type';
import { JwtConfigService } from '@config/jwt-config.service';
import type { INoteProtectionPort } from '@modules/notes/application/ports/note-protection.port';

/**
 * Infrastructure adapter for note password protection.
 * Wraps Prisma + bcrypt + JWT unlock token logic behind the INoteProtectionPort interface.
 * This is the ONLY place in the application where bcrypt and protection JWT operations live.
 */
@Injectable()
export class PrismaNoteProtectionAdapter implements INoteProtectionPort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaTransactionClient,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  async setPassword(userId: string, noteId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.noteProtection.upsert({
      where: { userId_noteId: { userId, noteId } },
      update: { passwordHash },
      create: { userId, noteId, passwordHash },
    });
  }

  async verifyPassword(userId: string, noteId: string, password: string): Promise<boolean> {
    // For the port interface, userId is the requesting user; find the note owner's protection record
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { userId: true },
    });

    if (!note) return false;

    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId } },
    });

    if (!protection) return false;

    return bcrypt.compare(password, protection.passwordHash);
  }

  async removePassword(userId: string, noteId: string): Promise<void> {
    await this.prisma.noteProtection.deleteMany({
      where: { userId, noteId },
    });
  }

  async verifyUnlockToken(userId: string, noteId: string, token?: string): Promise<boolean> {
    if (!token) return false;
    try {
      const payload = this.jwtService.verify<{ sub: string; noteId: string; type: string }>(
        token,
        { secret: this.jwtConfig.getNoteUnlockTokenSecret() },
      );
      return payload.sub === userId && payload.noteId === noteId && payload.type === 'note-unlock';
    } catch {
      return false;
    }
  }

  /**
   * Used by verify-password command to issue a time-limited unlock token.
   * Not part of INoteProtectionPort (presentation concern), called directly from handler.
   */
  async issueUnlockToken(userId: string, noteId: string): Promise<string> {
    return this.jwtService.sign(
      { sub: userId, noteId, type: 'note-unlock' },
      this.jwtConfig.getNoteUnlockTokenSignOptions(),
    );
  }
}



