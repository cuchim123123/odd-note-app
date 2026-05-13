import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export type NoteResponse = {
  id: string;
  title: string;
  content?: string;
  isPinned: boolean;
  isProtected: boolean;
  isShared: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NoteResponse[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return await Promise.all(notes.map((note) => this.toResponse(note)));
  }

  async getById(userId: string, noteId: string): Promise<NoteResponse> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return await this.toResponse(note);
  }

  async create(userId: string, input: { title: string; content?: string; labels?: string[] }): Promise<NoteResponse> {
    const note = await this.prisma.note.create({
      data: {
        userId,
        title: input.title.trim(),
        content: input.content ?? null,
        labels: input.labels ?? [],
      },
    });

    return await this.toResponse(note);
  }

  async update(
    userId: string,
    noteId: string,
    input: { title?: string; content?: string; isPinned?: boolean; labels?: string[] },
  ): Promise<NoteResponse> {
    const existing = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        title: input.title?.trim() ?? existing.title,
        content: input.content ?? existing.content,
        isPinned: input.isPinned ?? existing.isPinned,
        labels: input.labels ?? existing.labels,
      },
    });

    return await this.toResponse(note);
  }

  async delete(userId: string, noteId: string): Promise<void> {
    const existing = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.$transaction([
      this.prisma.noteProtection.deleteMany({ where: { userId, noteId } }),
      this.prisma.note.delete({ where: { id: noteId } }),
    ]);
  }

  async getProtectionStatus(userId: string, noteId: string): Promise<{ isProtected: boolean }> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId, noteId } },
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
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId, noteId } },
    });

    if (!protection) {
      return { verified: false };
    }

    return { verified: await bcrypt.compare(password, protection.passwordHash) };
  }

  async removePassword(userId: string, noteId: string, password: string): Promise<{ removed: true }> {
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

  private async toResponse(note: {
    id: string;
    title: string;
    content: string | null;
    isPinned: boolean;
    isShared: boolean;
    labels: string[];
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<NoteResponse> {
    const protection = await this.prisma.noteProtection.findUnique({
      where: { userId_noteId: { userId: note.userId, noteId: note.id } },
      select: { id: true },
    });

    return {
      id: note.id,
      title: note.title,
      content: note.content ?? '',
      isPinned: note.isPinned,
      isProtected: Boolean(protection),
      isShared: note.isShared,
      labels: note.labels,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
