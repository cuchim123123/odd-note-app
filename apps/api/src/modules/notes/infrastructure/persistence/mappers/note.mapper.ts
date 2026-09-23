import { NoteEntity } from '@modules/notes/domain/entities/note.entity';
import type { NoteShare } from '@modules/notes/domain/entities/note.entity';
import { NoteTitle } from '@modules/notes/domain/value-objects/note-title.vo';
import { SharePermission } from '@modules/notes/domain/value-objects/share-permission.vo';
import { ShareId, UserId } from '@shared/domain/ddd/id-types';

/**
 * Prisma record shape we expect when loading a Note with its shares.
 * This is a local structural type — no Prisma generated types in domain/application.
 */
export interface PrismaNoteFull {
  id: string;
  userId: string;
  title: string;
  isShared: boolean;
  aiTags: string[];
  rejectedAiTags: string[];
  aiTagsSeq: bigint;
  createdAt: Date;
  updatedAt: Date;
  shares: Array<{
    id: string;
    recipientId: string | null;
    recipientEmail: string;
    permission: string; // 'READ' | 'EDIT' from Prisma enum
  }>;
  /** Presence of this record means the note is password-protected. */
  protection?: { id: string } | null;
}

export class NoteMapper {
  static toDomain(record: PrismaNoteFull): NoteEntity {
    const shares: NoteShare[] = record.shares
      .filter((s): s is typeof s & { recipientId: string } => s.recipientId !== null)
      .map((s) => ({
        id: ShareId.from(s.id),
        recipientId: UserId.from(s.recipientId),
        recipientEmail: s.recipientEmail,
        permission: SharePermission.create(s.permission),
      }));

    const props = {
      ownerId: record.userId,
      title: NoteTitle.create(record.title),
      isShared: record.isShared,
      shares,
      isProtected: !!record.protection,
      aiTags: record.aiTags,
      rejectedAiTags: record.rejectedAiTags,
      aiTagsSnapshotSeq: record.aiTagsSeq,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    return NoteEntity.load(record.id, props);
  }

  static toPersistence(note: NoteEntity): {
    id: string;
    userId: string;
    title: string;
    isShared: boolean;
    aiTags: string[];
    rejectedAiTags: string[];
    aiTagsSeq: bigint;
    updatedAt: Date;
    shares: Array<{
      id: string;
      recipientId: string;
      recipientEmail: string;
      permission: string;
    }>;
  } {
    return {
      id: note.id,
      userId: note.ownerId,
      title: note.title,
      isShared: note.isShared,
      aiTags: [...note.aiTags],
      rejectedAiTags: [...note.rejectedAiTags],
      aiTagsSeq: note.aiTagsSnapshotSeq,
      updatedAt: note.updatedAt,
      shares: note.shares.map((s) => ({
        id: s.id,
        recipientId: s.recipientId,
        recipientEmail: s.recipientEmail,
        permission: s.permission.value,
      })),
    };
  }
}
