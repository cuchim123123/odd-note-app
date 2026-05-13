import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthConfigService } from '../config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotesService {
  private readonly passwordSaltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
  ) {
    this.passwordSaltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async getProtectionStatus(userId: string, noteId: string): Promise<{ isProtected: boolean }> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: {
        userId_noteId: {
          userId,
          noteId,
        },
      },
      select: { id: true },
    });

    return { isProtected: Boolean(protection) };
  }

  async setPassword(userId: string, noteId: string, password: string): Promise<{ isProtected: true }> {
    const passwordHash = await bcrypt.hash(password, this.passwordSaltRounds);

    await this.prisma.noteProtection.upsert({
      where: {
        userId_noteId: {
          userId,
          noteId,
        },
      },
      update: {
        passwordHash,
      },
      create: {
        userId,
        noteId,
        passwordHash,
      },
    });

    return { isProtected: true };
  }

  async verifyPassword(userId: string, noteId: string, password: string): Promise<{ verified: boolean }> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: {
        userId_noteId: {
          userId,
          noteId,
        },
      },
    });

    if (!protection) {
      return { verified: false };
    }

    const isValid = await bcrypt.compare(password, protection.passwordHash);
    return { verified: isValid };
  }

  async removePassword(userId: string, noteId: string, password: string): Promise<{ removed: true }> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: {
        userId_noteId: {
          userId,
          noteId,
        },
      },
    });

    if (!protection) {
      throw new UnauthorizedException('No protection is set for this note');
    }

    const isValid = await bcrypt.compare(password, protection.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.prisma.noteProtection.delete({
      where: {
        userId_noteId: {
          userId,
          noteId,
        },
      },
    });

    return { removed: true };
  }
}
