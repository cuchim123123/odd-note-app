import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

type SharePermission = 'READ' | 'EDIT';

type SharedByProfile = {
  id: string;
  email: string;
  displayName: string;
};

type NoteWithShares = {
  id: string;
  title: string;
  content: string | null;
  isPinned: boolean;
  isShared: boolean;
  labels: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  shares: Array<{ id: string }>;
};

type ShareRecordWithRelations = {
  id: string;
  recipientEmail: string;
  permission: SharePermission;
  createdAt: Date;
  updatedAt: Date;
  owner: SharedByProfile;
  recipient: { displayName: string } | null;
  note: NoteWithShares;
};

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
  accessMode: 'owner' | 'shared';
  sharedPermission?: SharePermission | undefined;
  sharedBy?: SharedByProfile | undefined;
  sharedAt?: string | undefined;
};

export type SharedNoteResponse = NoteResponse & {
  accessMode: 'shared';
  sharedPermission: SharePermission;
  sharedBy: SharedByProfile;
  sharedAt: string;
};

export type NoteShareResponse = {
  id: string;
  recipientEmail: string;
  recipientDisplayName?: string | undefined;
  permission: SharePermission;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NoteResponse[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      include: { shares: { select: { id: true } } },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    return await Promise.all(notes.map((note: NoteWithShares) => this.toResponse(note)));
  }

  async listSharedWithMe(userId: string): Promise<SharedNoteResponse[]> {
    const sharedNotes = await this.prisma.noteShare.findMany({
      where: { recipientId: userId },
      include: {
        owner: { select: { id: true, email: true, displayName: true } },
        recipient: { select: { displayName: true } },
        note: { include: { shares: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return await Promise.all(sharedNotes.map((share: ShareRecordWithRelations) => this.toSharedResponse(share)));
  }

  async getById(userId: string, noteId: string): Promise<NoteResponse> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      include: { shares: { select: { id: true } } },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const sharedAccess = await this.prisma.noteShare.findFirst({
      where: { noteId, recipientId: userId },
      include: { owner: { select: { id: true, email: true, displayName: true } } },
    });

    return await this.toResponse(note as NoteWithShares, sharedAccess ? { permission: sharedAccess.permission, owner: sharedAccess.owner, createdAt: sharedAccess.createdAt } : undefined);
  }

  async create(userId: string, input: { title: string; content?: string; labels?: string[] }): Promise<NoteResponse> {
    const note = await this.prisma.note.create({
      data: {
        userId,
        title: input.title.trim(),
        content: input.content ?? null,
        labels: input.labels ?? [],
      },
      include: { shares: { select: { id: true } } },
    });

    return await this.toResponse(note as NoteWithShares);
  }

  async update(
    userId: string,
    noteId: string,
    input: { title?: string; content?: string; isPinned?: boolean; isShared?: boolean; labels?: string[] },
  ): Promise<NoteResponse> {
    const existing = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
      },
      include: { shares: { select: { id: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    const isOwner = existing.userId === userId;
    if (!isOwner) {
      const editShare = await this.prisma.noteShare.findFirst({
        where: { noteId, recipientId: userId, permission: 'EDIT' },
      });

      if (!editShare) {
        throw new UnauthorizedException('You do not have permission to edit this note');
      }
    }

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        title: input.title?.trim() ?? existing.title,
        content: input.content ?? existing.content,
        isPinned: input.isPinned ?? existing.isPinned,
        isShared: input.isShared ?? existing.isShared,
        labels: input.labels ?? existing.labels,
      },
      include: { shares: { select: { id: true } } },
    });

    return await this.toResponse(note as NoteWithShares);
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

  async listShares(userId: string, noteId: string): Promise<NoteShareResponse[]> {
    await this.ensureOwnedNote(userId, noteId);

    const shares = await this.prisma.noteShare.findMany({
      where: { noteId, ownerId: userId },
      include: { recipient: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => ({
      id: share.id,
      recipientEmail: share.recipientEmail,
      recipientDisplayName: share.recipient?.displayName ?? undefined,
      permission: share.permission as SharePermission,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    }));
  }

  async createShare(
    userId: string,
    noteId: string,
    input: { recipientEmail: string; permission: SharePermission },
  ): Promise<NoteShareResponse> {
    await this.ensureOwnedNote(userId, noteId);

    const recipientEmail = input.recipientEmail.trim().toLowerCase();
    const recipient = await this.prisma.user.findUnique({ where: { email: recipientEmail } });

    if (!recipient) {
      throw new BadRequestException('Recipient must already have an account');
    }

    const share = await this.prisma.noteShare.upsert({
      where: { noteId_recipientEmail: { noteId, recipientEmail } },
      update: {
        ownerId: userId,
        recipientId: recipient.id,
        permission: input.permission,
      },
      create: {
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail,
        permission: input.permission,
      },
      include: { recipient: { select: { displayName: true } } },
    });

    return {
      id: share.id,
      recipientEmail: share.recipientEmail,
      recipientDisplayName: share.recipient?.displayName,
      permission: share.permission as SharePermission,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    };
  }

  async updateShare(
    userId: string,
    noteId: string,
    shareId: string,
    input: { permission: SharePermission },
  ): Promise<NoteShareResponse> {
    await this.ensureOwnedNote(userId, noteId);

    const share = await this.prisma.noteShare.findFirst({
      where: { id: shareId, noteId, ownerId: userId },
      include: { recipient: { select: { displayName: true } } },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const updated = await this.prisma.noteShare.update({
      where: { id: shareId },
      data: { permission: input.permission },
      include: { recipient: { select: { displayName: true } } },
    });

    return {
      id: updated.id,
      recipientEmail: updated.recipientEmail,
      recipientDisplayName: updated.recipient?.displayName ?? undefined,
      permission: updated.permission as SharePermission,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteShare(userId: string, noteId: string, shareId: string): Promise<{ removed: true }> {
    await this.ensureOwnedNote(userId, noteId);

    const share = await this.prisma.noteShare.findFirst({
      where: { id: shareId, noteId, ownerId: userId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.prisma.noteShare.delete({ where: { id: shareId } });
    return { removed: true };
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

  private async ensureOwnedNote(userId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });

    if (!note) {
      throw new NotFoundException('Note not found');
    }
  }

  private async toResponse(note: NoteWithShares, sharedAccess?: { permission: SharePermission; owner: SharedByProfile; createdAt: Date }): Promise<NoteResponse> {
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
      isShared: note.isShared || note.shares.length > 0 || Boolean(sharedAccess),
      labels: note.labels,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      accessMode: sharedAccess ? 'shared' : 'owner',
      sharedPermission: sharedAccess?.permission,
      sharedBy: sharedAccess?.owner,
      sharedAt: sharedAccess?.createdAt.toISOString(),
    };
  }

  private async toSharedResponse(share: ShareRecordWithRelations): Promise<SharedNoteResponse> {
    const note = await this.toResponse(share.note, {
      permission: share.permission,
      owner: share.owner,
      createdAt: share.createdAt,
    });

    return {
      ...note,
      accessMode: 'shared',
      sharedPermission: share.permission,
      sharedBy: share.owner,
      sharedAt: share.createdAt.toISOString(),
    };
  }
}
