import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { INoteQueryDao, NoteView, SharedNoteView, NoteShareView } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';

/**
 * MongoDB-backed implementation of INoteQueryDao.
 * Reads from denormalized note_projections collection.
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
      .lean();

    return docs.map((doc) => this.mapDocToNoteView(doc, userId));
  }

  async findNoteById(noteId: string, userId: string): Promise<NoteView | null> {
    const doc = await this.noteModel
      .findOne({
        _id: noteId,
        $or: [{ userId }, { 'shares.recipientId': userId }],
      })
      .lean();

    if (!doc) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const share = doc.shares?.find((s: any) => s.recipientId === userId);
    return this.mapDocToNoteView(doc, userId, share);
  }

  async findSharedWithMe(userId: string): Promise<SharedNoteView[]> {
    const docs = await this.noteModel.aggregate([
      { $match: { 'shares.recipientId': userId } },
      {
        $addFields: {
          myShare: {
            $arrayElemAt: [
              { $filter: { input: '$shares', as: 's', cond: { $eq: ['$$s.recipientId', userId] } } },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          isPinned: { $ifNull: ['$myShare.isPinned', false] },
        },
      },
      { $sort: { isPinned: -1, updatedAt: -1 } },
    ]);

    return docs
      .map((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const share = doc.shares?.find((s: any) => s.recipientId === userId);
        if (!share) return null;
        return this.mapDocToNoteView(doc, userId, share) as SharedNoteView;
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

  private mapDocToNoteView(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    userId: string,
    share?: { permission: 'READ' | 'EDIT'; sharedAt: Date; recipientId: string | null } | undefined,
  ): NoteView {
    let isPinned = false;
    let labels: string[] = [];

    if (share && doc.myShare) {
      // If it came from the aggregation pipeline (findSharedWithMe)
      isPinned = doc.myShare.isPinned ?? false;
      labels = doc.myShare.labels ?? [];
    } else if (share) {
      // If it came from findNoteById
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shareData = doc.shares?.find((s: any) => s.recipientId === userId);
      isPinned = shareData?.isPinned ?? false;
      labels = shareData?.labels ?? [];
    } else {
      // Owner
      isPinned = doc.isPinned ?? false;
      labels = doc.labels ?? [];
    }

    const result: NoteView = {
      id: doc._id as string,
      title: doc.title,
      isPinned,
      isProtected: doc.isProtected,
      isShared: doc.isShared,
      labels,
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
