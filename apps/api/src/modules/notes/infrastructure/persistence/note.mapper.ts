import { NoteEntity } from '../../domain/entities/note.entity';
import type { NoteShare } from '../../domain/entities/note.entity';
import { NoteTitle } from '../../domain/value-objects/note-title.vo';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { ShareId, UserId } from '../../../../common/domain/id-types';

/**
 * Prisma record shape we expect when loading a Note with its shares.
 * This is a local structural type — no Prisma generated types in domain/application.
 */
export interface PrismaNoteFull {
  id: string;
  userId: string;
  title: string;
  isShared: boolean;
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
      .filter((s) => s.recipientId !== null)
      .map((s) => ({
        id: ShareId.from(s.id),
        recipientId: UserId.from(s.recipientId as string),
        recipientEmail: s.recipientEmail,
        permission: SharePermission.create(s.permission),
      }));


    const props = {
      ownerId: record.userId,
      title: NoteTitle.create(record.title),
      isShared: record.isShared,
      shares,
      isProtected: !!record.protection,
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
    updatedAt: Date;
  } {
    return {
      id: note.id,
      userId: note.ownerId,
      title: note.title,
      isShared: note.isShared,
      updatedAt: note.updatedAt,
    };
  }
}
