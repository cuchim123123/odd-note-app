import { Injectable, Inject } from '@nestjs/common';
import type { IUserPreferencesRepository } from '../../application/ports/user-preferences.repository.port';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { PrismaTransactionClient } from './prisma-client.type';

/**
 * Infrastructure adapter: manages per-user note preferences (pins and labels).
 * These are user-scoped personalisation data — they live outside the Note aggregate boundary.
 */
@Injectable()
export class PrismaUserPreferencesRepository implements IUserPreferencesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  async upsertPin(userId: string, noteId: string, isPinned: boolean): Promise<{ isPinned: boolean }> {
    const record = await this.prisma.userNotePin.upsert({
      where: { userId_noteId: { userId, noteId } },
      create: { userId, noteId, isPinned },
      update: { isPinned },
    });
    return { isPinned: record.isPinned };
  }

  async getPin(userId: string, noteId: string): Promise<boolean> {
    const record = await this.prisma.userNotePin.findUnique({
      where: { userId_noteId: { userId, noteId } },
    });
    return record?.isPinned ?? false;
  }

  async upsertLabel(userId: string, noteId: string, labels: string[]): Promise<void> {
    await this.prisma.userNoteLabel.upsert({
      where: { userId_noteId: { userId, noteId } },
      create: { userId, noteId, labels },
      update: { labels },
    });
  }

  async createLabel(userId: string, noteId: string, labels: string[]): Promise<void> {
    await this.prisma.userNoteLabel.create({
      data: { userId, noteId, labels },
    });
  }

  async renameLabel(userId: string, oldName: string, newName: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel"
      SET labels = array_replace(labels, ${oldName}, ${newName})
      WHERE "userId" = ${userId} AND ${oldName} = ANY(labels)
    `;
    return Number(result);
  }

  async deleteLabel(userId: string, labelName: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel"
      SET labels = array_remove(labels, ${labelName})
      WHERE "userId" = ${userId} AND ${labelName} = ANY(labels)
    `;
    return Number(result);
  }
}



