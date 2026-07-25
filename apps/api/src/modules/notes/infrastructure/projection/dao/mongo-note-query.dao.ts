import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { INoteQueryDao, NoteView, SharedNoteView, NoteShareView } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';

/**
 * MongoDB-backed implementation of INoteQueryDao.
 * Reads from denormalized note_projections collection.
 * Activated when PROJECTION_STORE=mongo via factory binding in NotesModule.
 *
 * NOTE: checkAccess and isProtected are NOT here — they live on INoteAccessPort
 * backed by PostgreSQL permanently (security boundary, must be consistent).
 */
@Injectable()
export class MongoNoteQueryDao implements INoteQueryDao {
  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  async findUserNotes(userId: string): Promise<NoteView[]> {
    const docs = await this.noteModel
      .find({ userId })
      .sort({ isPinned: -1, updatedAt: -1 })
      .lean()
      .exec();

    return docs.map((doc) => this.mapDocToNoteView(doc));
  }

  async findNoteById(noteId: string, userId: string): Promise<NoteView | null> {
    const doc = await this.noteModel
      .findOne({
        _id: noteId,
        $or: [{ userId }, { 'shares.recipientId': userId }],
      })
      .lean()
      .exec();

    if (!doc) return null;

    const share = doc.shares.find((s) => s.recipientId === userId);
    return this.mapDocToNoteView(doc, share);
  }

  async findSharedWithMe(userId: string): Promise<SharedNoteView[]> {
    const docs = await this.noteModel
      .find({ 'shares.recipientId': userId })
      .sort({ isPinned: -1, updatedAt: -1 })
      .lean()
      .exec();

    return docs
      .map((doc) => {
        const share = doc.shares.find((s) => s.recipientId === userId);
        if (!share) return null;
        return this.mapDocToNoteView(doc, share) as SharedNoteView;
      })
      .filter((v): v is SharedNoteView => v !== null);
  }

  async findNoteShares(noteId: string, userId: string): Promise<NoteShareView[] | null> {
    const doc = await this.noteModel
      .findOne({ _id: noteId, userId })
      .lean()
      .exec();

    if (!doc) return null;

    return doc.shares.map((s) => {
      const result: NoteShareView = {
        id: s.shareId,
        recipientEmail: s.recipientEmail,
        permission: s.permission,
        createdAt: s.sharedAt,
        updatedAt: s.sharedAt,
      };
      if (s.recipientDisplayName) {
        result.recipientDisplayName = s.recipientDisplayName;
      }
      return result;
    });
  }

  // ────────────────────────────────────────────────────────────────────────────

  private mapDocToNoteView(
    doc: NoteProjectionDocument,
    share?: { permission: 'READ' | 'EDIT'; sharedAt: Date; recipientId: string | null } | undefined,
  ): NoteView {
    const result: NoteView = {
      id: doc._id,
      title: doc.title,
      content: null, // content is never stored in projection — resolved at query handler level
      isPinned: doc.isPinned,
      isProtected: doc.isProtected,
      isShared: doc.isShared,
      labels: doc.labels,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      accessMode: share ? 'shared' : 'owner',
    };

    if (share) {
      result.sharedPermission = share.permission;
      result.sharedAt = share.sharedAt;
    }

    return result;
  }
}
