import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../common/mailer/mailer.service';
import { RedisService } from '../redis/redis.service';
import { NotesCrdtService, type CollaborationSnapshot } from './notes-crdt.service';
import { NotesProtectionService } from './notes-protection.service';
import { REDIS_CHANNELS } from '../collaboration/collaboration.constants';

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

type NoteWithRelations = NoteWithShares & {
  protection?: { id: string } | null;
};

type ShareRecordWithRelations = {
  id: string;
  recipientEmail: string;
  permission: SharePermission;
  createdAt: Date;
  updatedAt: Date;
  owner: SharedByProfile;
  recipient: { displayName: string } | null;
  note: NoteWithRelations;
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

export type NoteDraftResponse = {
  title: string;
  content: string;
  updatedAt: string;
};


@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly redis: RedisService,
    private readonly notesCrdtService: NotesCrdtService,
    private readonly notesProtectionService: NotesProtectionService,
  ) {}

  private async getUserNoteLabelsMap(userId: string, noteIds: string[]): Promise<Record<string, string[]>> {
    const userLabels = await this.prisma.userNoteLabel.findMany({
      where: { userId, noteId: { in: noteIds } },
      select: { noteId: true, labels: true },
    });

    const map: Record<string, string[]> = {};
    for (const record of userLabels) {
      map[record.noteId] = record.labels;
    }
    return map;
  }

  async list(userId: string): Promise<NoteResponse[]> {
    const notes = await this.prisma.note.findMany({
      where: { userId },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });

    const noteIds = notes.map((n) => n.id);
    const labelsMap = await this.getUserNoteLabelsMap(userId, noteIds);

    return await Promise.all(
      notes.map(async (note) => {
        const personalLabels = labelsMap[note.id] ?? [];
        const noteWithPersonalLabels = { ...note, labels: personalLabels };
        return this.toResponse(noteWithPersonalLabels as NoteWithRelations, undefined, undefined, undefined, userId, undefined, true);
      }),
    );
  }

  async listSharedWithMe(userId: string): Promise<SharedNoteResponse[]> {
    const sharedNotes = await this.prisma.noteShare.findMany({
      where: { recipientId: userId },
      include: {
        owner: { select: { id: true, email: true, displayName: true } },
        recipient: { select: { displayName: true } },
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
    const labelsMap = await this.getUserNoteLabelsMap(userId, noteIds);

    return await Promise.all(
      sharedNotes.map(async (share) => {
        const personalLabels = labelsMap[share.note.id] ?? [];
        const noteWithPersonalLabels = { ...share.note, labels: personalLabels };
        const shareWithPersonalLabels = { ...share, note: noteWithPersonalLabels };
        return this.toSharedResponse(shareWithPersonalLabels as ShareRecordWithRelations, undefined, undefined, userId, undefined, true);
      }),
    );
  }

  async getById(userId: string, noteId: string, unlockToken?: string): Promise<NoteResponse> {
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

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const sharedAccess = await this.prisma.noteShare.findFirst({
      where: { noteId, recipientId: userId },
      include: { owner: { select: { id: true, email: true, displayName: true } } },
    });

    const yDocContent = await this.notesCrdtService.readYDocContent(noteId);
    const snapshot = yDocContent !== null ? null : await this.notesCrdtService.readCollaborationSnapshot(noteId);

    const personalLabelRecord = await this.prisma.userNoteLabel.findUnique({
      where: { userId_noteId: { userId, noteId } },
      select: { labels: true },
    });
    const personalLabels = personalLabelRecord?.labels ?? [];
    const noteWithPersonalLabels = { ...note, labels: personalLabels };

    return await this.toResponse(
      noteWithPersonalLabels as NoteWithRelations,
      sharedAccess ? { permission: sharedAccess.permission, owner: sharedAccess.owner, createdAt: sharedAccess.createdAt } : undefined,
      snapshot,
      yDocContent ?? undefined,
      userId,
      unlockToken,
    );
  }

  async create(userId: string, input: { title: string; content?: string; labels?: string[] }): Promise<NoteResponse> {
    const note = await this.prisma.note.create({
      data: {
        userId,
        title: input.title.trim(),
        content: input.content ?? null,
        labels: [],
      },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    let personalLabels: string[] = [];
    if (input.labels && input.labels.length > 0) {
      const labelRecord = await this.prisma.userNoteLabel.create({
        data: {
          userId,
          noteId: note.id,
          labels: input.labels,
        },
      });
      personalLabels = labelRecord.labels;
    }

    const noteWithRelations = { ...note, labels: personalLabels } as NoteWithRelations;
    const yDocContent = await this.notesCrdtService.readYDocContent(note.id);
    const snapshot = yDocContent !== null ? null : await this.notesCrdtService.readCollaborationSnapshot(note.id);
    return await this.toResponse(noteWithRelations, undefined, snapshot, yDocContent ?? undefined);
  }

  async update(
    userId: string,
    noteId: string,
    input: { title?: string; content?: string; isPinned?: boolean; isShared?: boolean; labels?: string[] },
    unlockToken?: string,
  ): Promise<NoteResponse> {
    const existing = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
      },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
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
      },
      include: {
        shares: { select: { id: true } },
        protection: { select: { id: true } },
      },
    });

    let personalLabels = existing.labels;
    if (input.labels !== undefined) {
      const upserted = await this.prisma.userNoteLabel.upsert({
        where: { userId_noteId: { userId, noteId } },
        create: {
          userId,
          noteId,
          labels: input.labels,
        },
        update: {
          labels: input.labels,
        },
      });
      personalLabels = upserted.labels;
    } else {
      const record = await this.prisma.userNoteLabel.findUnique({
        where: { userId_noteId: { userId, noteId } },
        select: { labels: true },
      });
      personalLabels = record?.labels ?? [];
    }

    const noteWithRelations = { ...note, labels: personalLabels } as NoteWithRelations;
    await this.notesCrdtService.persistCollaborationSnapshot(
      noteWithRelations.id,
      noteWithRelations.title,
      noteWithRelations.content,
      noteWithRelations.isPinned,
      noteWithRelations.updatedAt,
    );
    const yDocContent = await this.notesCrdtService.readYDocContent(note.id);
    const snapshot = yDocContent !== null ? null : await this.notesCrdtService.readCollaborationSnapshot(note.id);
    return await this.toResponse(noteWithRelations, undefined, snapshot, yDocContent ?? undefined, userId, unlockToken);
  }

  async delete(userId: string, noteId: string): Promise<void> {
    const existing = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!existing) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.$transaction([
      this.prisma.noteProtection.deleteMany({ where: { userId, noteId } }),
      this.prisma.userNoteLabel.deleteMany({ where: { noteId } }),
      this.prisma.note.delete({ where: { id: noteId } }),
    ]);

    await Promise.all([
      this.notesCrdtService.clearCollaborationSnapshot(noteId),
      this.notesCrdtService.clearYDocState(noteId),
    ]);

    void this.notifyCollaborationChange(noteId, 'note_deleted');
  }





  async getDraft(userId: string, noteId: string, unlockToken?: string): Promise<NoteDraftResponse | null> {
    await this.ensureCanEditNote(userId, noteId);

    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { userId: true },
    });
    if (note) {
      const protection = await this.prisma.noteProtection.findUnique({
        where: { userId_noteId: { userId: note.userId, noteId } },
        select: { id: true },
      });
      if (protection) {
        const isUnlocked = await this.notesProtectionService.verifyUnlockToken(userId, noteId, unlockToken);
        if (!isUnlocked) {
          throw new UnauthorizedException('Note is locked');
        }
      }
    }

    const value = await this.redis.getClient().get(this.getDraftKey(userId, noteId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as NoteDraftResponse;
    } catch {
      return null;
    }
  }

  async saveDraft(
    userId: string,
    noteId: string,
    input: { title: string; content: string },
  ): Promise<{ saved: true; updatedAt: string }> {
    await this.ensureCanEditNote(userId, noteId);

    const updatedAt = new Date().toISOString();
    const payload: NoteDraftResponse = {
      title: input.title,
      content: input.content,
      updatedAt,
    };

    await this.redis.getClient().set(this.getDraftKey(userId, noteId), JSON.stringify(payload), 'EX', 60 * 60 * 24);

    return { saved: true, updatedAt };
  }

  async clearDraft(userId: string, noteId: string): Promise<{ cleared: true }> {
    await this.ensureCanEditNote(userId, noteId);
    await this.redis.getClient().del(this.getDraftKey(userId, noteId));
    return { cleared: true };
  }

  async renameLabel(userId: string, oldName: string, newName: string): Promise<{ updatedCount: number }> {
    const oldLabel = oldName.trim();
    const newLabel = newName.trim();

    if (!oldLabel || !newLabel) {
      throw new BadRequestException('Label names cannot be empty');
    }

    if (oldLabel === newLabel) {
      return { updatedCount: 0 };
    }

    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel" 
      SET labels = array_replace(labels, ${oldLabel}, ${newLabel}) 
      WHERE "userId" = ${userId} AND ${oldLabel} = ANY(labels)
    `;

    return { updatedCount: Number(result) };
  }

  async deleteLabel(userId: string, labelName: string): Promise<{ updatedCount: number }> {
    const label = labelName.trim();
    if (!label) {
      throw new BadRequestException('Label name cannot be empty');
    }

    const result = await this.prisma.$executeRaw`
      UPDATE "UserNoteLabel" 
      SET labels = array_remove(labels, ${label}) 
      WHERE "userId" = ${userId} AND ${label} = ANY(labels)
    `;

    return { updatedCount: Number(result) };
  }

  private getDraftKey(userId: string, noteId: string): string {
    return `note:draft:${userId}:${noteId}`;
  }

  private async ensureCanEditNote(userId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId, permission: 'EDIT' } } }],
      },
      select: { id: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }
  }

  private mergeNoteWithSnapshot(note: NoteWithRelations, snapshot?: CollaborationSnapshot | null): NoteWithRelations {
    if (!snapshot) {
      return note;
    }

    const noteUpdatedAt = new Date(note.updatedAt).getTime();
    const snapshotUpdatedAt = new Date(snapshot.updatedAt).getTime();
    if (Number.isNaN(snapshotUpdatedAt) || snapshotUpdatedAt <= noteUpdatedAt) {
      return note;
    }

    return {
      ...note,
      title: snapshot.title,
      content: snapshot.content,
      isPinned: snapshot.isPinned,
      updatedAt: new Date(snapshot.updatedAt),
    };
  }

  private async toResponse(
    note: NoteWithRelations,
    sharedAccess?: { permission: SharePermission; owner: SharedByProfile; createdAt: Date },
    snapshot?: CollaborationSnapshot | null,
    yDocContent?: string,
    requestingUserId?: string,
    unlockToken?: string,
    excludeContent = false,
  ): Promise<NoteResponse> {
    const effectiveNote = excludeContent ? note : this.mergeNoteWithSnapshot(note, snapshot);
    const effectiveContent = excludeContent ? '' : (yDocContent !== undefined ? yDocContent : effectiveNote.content ?? '');

    let isProtected = false;
    if (effectiveNote.protection !== undefined) {
      isProtected = Boolean(effectiveNote.protection);
    } else {
      const protection = await this.prisma.noteProtection.findUnique({
        where: { userId_noteId: { userId: effectiveNote.userId, noteId: effectiveNote.id } },
        select: { id: true },
      });
      isProtected = Boolean(protection);
    }

    let content = effectiveContent;

    if (!excludeContent && isProtected && requestingUserId) {
      const isUnlocked = await this.notesProtectionService.verifyUnlockToken(requestingUserId, effectiveNote.id, unlockToken);
      if (!isUnlocked) {
        content = ''; // Plaintext protection enforcement on the server!
      }
    }

    return {
      id: effectiveNote.id,
      title: effectiveNote.title,
      content,
      isPinned: effectiveNote.isPinned,
      isProtected,
      isShared: effectiveNote.isShared || effectiveNote.shares.length > 0 || Boolean(sharedAccess),
      labels: effectiveNote.labels,
      createdAt: effectiveNote.createdAt.toISOString(),
      updatedAt: effectiveNote.updatedAt.toISOString(),
      accessMode: sharedAccess ? 'shared' : 'owner',
      sharedPermission: sharedAccess?.permission,
      sharedBy: sharedAccess?.owner,
      sharedAt: sharedAccess?.createdAt.toISOString(),
    };
  }

  private async toSharedResponse(
    share: ShareRecordWithRelations,
    snapshot?: CollaborationSnapshot | null,
    yDocContent?: string,
    requestingUserId?: string,
    unlockToken?: string,
    excludeContent = false,
  ): Promise<SharedNoteResponse> {
    const note = await this.toResponse(share.note, {
      permission: share.permission,
      owner: share.owner,
      createdAt: share.createdAt,
    }, snapshot, yDocContent, requestingUserId, unlockToken, excludeContent);

    return {
      ...note,
      accessMode: 'shared',
      sharedPermission: share.permission,
      sharedBy: share.owner,
      sharedAt: share.createdAt.toISOString(),
    };
  }

  private async notifyCollaborationChange(noteId: string, type: 'permissions_updated' | 'note_deleted'): Promise<void> {
    try {
      await this.redis.getClient().publish(REDIS_CHANNELS.COLLABORATION_EVENTS, JSON.stringify({ type, noteId }));
    } catch (err) {
      console.error('Failed to publish collaboration event', err);
    }
  }


}
