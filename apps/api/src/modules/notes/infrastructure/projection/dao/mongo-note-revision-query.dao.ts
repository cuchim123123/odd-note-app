import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { INoteRevisionQueryDao } from '@modules/notes/application/ports/dao/note-revision-query.dao.port';
import type { NoteRevisionSummaryDto } from '@modules/notes/presentation/http/dto/note-revision-summary.dto';
import { NoteRevisionProjection, type NoteRevisionProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-revision-projection.schema';

/**
 * MongoDB-backed implementation of INoteRevisionQueryDao.
 * Reads from the append-only note_revision_projections collection.
 * Documents here are never updated — idempotency is by _id uniqueness.
 */
@Injectable()
export class MongoNoteRevisionQueryDao implements INoteRevisionQueryDao {
  constructor(
    @InjectModel(NoteRevisionProjection.name)
    private readonly revisionModel: Model<NoteRevisionProjectionDocument>,
  ) {}

  async findByNoteId(noteId: string): Promise<NoteRevisionSummaryDto[]> {
    const docs = await this.revisionModel
      .find({ noteId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return docs.map((doc) => ({
      id: doc._id,
      targetSeq: doc.targetSeq,
      createdAt: doc.createdAt.toISOString(),
      createdBy: doc.createdBy,
      label: doc.label,
    }));
  }
}
