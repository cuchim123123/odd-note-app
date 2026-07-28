import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteQueryDao, NoteView, SharedNoteView } from '@modules/notes/application/ports/dao/note-query.dao.port';
import type { NoteShareView } from '@modules/notes/application/ports/dao/note-query.dao.port';

@Injectable()
export class PrismaNoteQueryDao implements INoteQueryDao {
  constructor(private readonly prisma: PrismaService) { }

  async findUserNotes(userId: string): Promise<NoteView[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
        userLabels: { where: { userId }, select: { labels: true } },
        userPins: { where: { userId }, select: { isPinned: true } },
      },
    });

    return notes
      .map((note) => this.mapToNoteView(note))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }

  async findNoteById(noteId: string, userId: string): Promise<NoteView | null> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      include: {
        shares: {
          where: { recipientId: userId },
          include: { owner: { select: { id: true, email: true, displayName: true } } },
        },
        protection: { select: { id: true } },
        userLabels: { where: { userId }, select: { labels: true } },
        userPins: { where: { userId }, select: { isPinned: true } },
      },
    });

    if (!note) return null;

    const sharedAccess = note.userId !== userId && note.shares[0]
      ? {
          permission: note.shares[0].permission,
          createdAt: note.shares[0].createdAt,
          owner: note.shares[0].owner,
        }
      : null;

    return this.mapToNoteView(note, sharedAccess);
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
            userLabels: { where: { userId }, select: { labels: true } },
            userPins: { where: { userId }, select: { isPinned: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sharedNotes
      .map((share) => this.mapToNoteView(share.note, share) as SharedNoteView)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.sharedAt.getTime() - a.sharedAt.getTime();
      });
  }

  async findNoteShares(noteId: string, userId: string): Promise<NoteShareView[] | null> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      include: {
        shares: {
          include: { recipient: { select: { displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!note) return null;

    const shares = note.shares;

    return shares.map((s) => {
      const result: NoteShareView = {
        id: s.id,
        recipientEmail: s.recipientEmail,
        permission: s.permission as 'READ' | 'EDIT',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
      if (s.recipient?.displayName) {
        result.recipientDisplayName = s.recipient.displayName;
      }
      return result;
    });
  }

  private mapToNoteView(
    note: {
      id: string;
      title: string;
      content: string | null;
      isShared: boolean;
      createdAt: Date;
      updatedAt: Date;
      protection?: { id: string } | null;
      shares?: { id: string }[];
      userPins?: { isPinned: boolean }[];
      userLabels?: { labels: string[] }[];
    },
    sharedAccess?: {
      permission: string;
      createdAt: Date;
      owner: { id: string; email: string; displayName: string };
    } | null
  ): NoteView {
    const result: NoteView = {
      id: note.id,
      title: note.title,
      content: note.content,
      isPinned: note.userPins?.[0]?.isPinned ?? false,
      isProtected: Boolean(note.protection),
      isShared: note.isShared || Boolean(note.shares && note.shares.length > 0),
      labels: note.userLabels?.[0]?.labels ?? [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      accessMode: sharedAccess ? 'shared' : 'owner',
    };

    if (sharedAccess) {
      result.sharedPermission = sharedAccess.permission as 'READ' | 'EDIT';
      result.sharedBy = sharedAccess.owner;
      result.sharedAt = sharedAccess.createdAt;
    }

    return result;
  }
}
