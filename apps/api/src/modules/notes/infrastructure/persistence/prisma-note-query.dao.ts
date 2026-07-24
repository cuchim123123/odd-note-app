import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteQueryDao, NoteView, SharedNoteView, NoteAccessView } from '@modules/notes/application/ports/dao/note-query.dao.port';
import type { NoteShareResponseDto } from '@modules/notes/presentation/http/dto/note.response.dto';

@Injectable()
export class PrismaNoteQueryDao implements INoteQueryDao {
  constructor(private readonly prisma: PrismaService) {}

  async findUserNotes(userId: string): Promise<NoteView[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    const noteIds = notes.map((n) => n.id);
    const [labelsRecords, pinsRecords] = await Promise.all([
      this.prisma.userNoteLabel.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, labels: true } }),
      this.prisma.userNotePin.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, isPinned: true } }),
    ]);

    const labelsMap = Object.fromEntries(labelsRecords.map((r) => [r.noteId, r.labels]));
    const pinsMap = Object.fromEntries(pinsRecords.map((r) => [r.noteId, r.isPinned]));

    const enriched = notes
      .map((note) => ({
        ...note,
        isPinned: pinsMap[note.id] ?? false,
        labels: labelsMap[note.id] ?? [],
      }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    return enriched.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      isPinned: note.isPinned,
      isProtected: Boolean(note.protection),
      isShared: note.isShared || note.shares.length > 0,
      labels: note.labels,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      accessMode: 'owner',
    }));
  }

  async findNoteById(noteId: string, userId: string): Promise<NoteView | null> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    if (!note) return null;

    const sharedAccess = note.userId !== userId
      ? await this.prisma.noteShare.findFirst({
          where: { noteId, recipientId: userId },
          include: { owner: { select: { id: true, email: true, displayName: true } } },
        })
      : null;

    const [labelsRecord, pinRecord] = await Promise.all([
      this.prisma.userNoteLabel.findUnique({ where: { userId_noteId: { userId, noteId } }, select: { labels: true } }),
      this.prisma.userNotePin.findUnique({ where: { userId_noteId: { userId, noteId } }, select: { isPinned: true } }),
    ]);

    return {
      id: note.id,
      title: note.title,
      content: note.content,
      isPinned: pinRecord?.isPinned ?? false,
      isProtected: Boolean(note.protection),
      isShared: note.isShared || note.shares.length > 0,
      labels: labelsRecord?.labels ?? [],
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      accessMode: sharedAccess ? 'shared' : 'owner',
      sharedPermission: sharedAccess ? (sharedAccess.permission as 'READ' | 'EDIT') : undefined,
      sharedBy: sharedAccess?.owner ?? undefined,
      sharedAt: sharedAccess?.createdAt.toISOString() ?? undefined,
    };
  }

  async findSharedWithMe(userId: string): Promise<SharedNoteView[]> {
    const sharedNotes = await this.prisma.noteShare.findMany({
      where: { recipientId: userId },
      include: {
        owner: { select: { id: true, email: true, displayName: true } },
        note: {
          include: {
            shares: { select: { id: true } },
            protection: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const noteIds = sharedNotes.map((s) => s.note.id);
    const [labelsRecords, pinsRecords] = await Promise.all([
      this.prisma.userNoteLabel.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, labels: true } }),
      this.prisma.userNotePin.findMany({ where: { userId, noteId: { in: noteIds } }, select: { noteId: true, isPinned: true } }),
    ]);

    const labelsMap = Object.fromEntries(labelsRecords.map((r) => [r.noteId, r.labels]));
    const pinsMap = Object.fromEntries(pinsRecords.map((r) => [r.noteId, r.isPinned]));

    const enriched = sharedNotes
      .map((share) => ({
        ...share,
        note: {
          ...share.note,
          isPinned: pinsMap[share.note.id] ?? false,
          labels: labelsMap[share.note.id] ?? [],
        },
      }))
      .sort((a, b) => {
        if (a.note.isPinned !== b.note.isPinned) return a.note.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return enriched.map((share) => ({
      id: share.note.id,
      title: share.note.title,
      content: share.note.content,
      isPinned: share.note.isPinned,
      isProtected: Boolean(share.note.protection),
      isShared: true,
      labels: share.note.labels,
      createdAt: share.note.createdAt.toISOString(),
      updatedAt: share.note.updatedAt.toISOString(),
      accessMode: 'shared',
      sharedPermission: share.permission as 'READ' | 'EDIT',
      sharedBy: share.owner,
      sharedAt: share.createdAt.toISOString(),
    }));
  }

  async findNoteShares(noteId: string, userId: string): Promise<NoteShareResponseDto[] | null> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) return null;

    const shares = await this.prisma.noteShare.findMany({
      where: { noteId },
      include: { recipient: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return shares.map((s) => ({
      id: s.id,
      recipientEmail: s.recipientEmail,
      recipientDisplayName: s.recipient?.displayName ?? undefined,
      permission: s.permission as 'READ' | 'EDIT',
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async checkAccess(noteId: string, userId: string): Promise<NoteAccessView | null> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { 
        userId: true, 
        shares: { where: { recipientId: userId }, select: { permission: true } },
        protection: { select: { id: true } }
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
      isProtected: Boolean(note.protection),
    };
    if (permission) {
      result.permission = permission;
    }
    
    return result;
  }
}
