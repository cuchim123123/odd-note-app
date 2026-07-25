import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type NoteRevisionProjectionDocument = HydratedDocument<NoteRevisionProjection>;

/**
 * Append-only projection of NoteRevision.
 * A revision is a named pointer to a NoteUpdate.seq — no content is stored.
 * Documents in this collection are NEVER updated after insert;
 * idempotency is enforced by MongoDB's _id uniqueness constraint.
 * No aggregateVersion needed — see architecture decision in migration plan.
 */
@Schema({ collection: 'note_revision_projections', versionKey: false })
export class NoteRevisionProjection {
  @Prop({ type: String, required: true })
  declare _id: string;

  @Prop({ type: String, required: true, index: true })
  declare noteId: string;

  /**
   * Pointer to NoteUpdate.seq — stored as string because BigInt cannot be
   * represented natively in JSON / MongoDB Number without precision loss.
   */
  @Prop({ type: String, required: true })
  declare targetSeq: string;

  @Prop({ type: String, default: null })
  declare label: string | null;

  @Prop({ type: String, required: true })
  declare createdBy: string;

  @Prop({ type: Date, required: true })
  declare createdAt: Date;
}

export const NoteRevisionProjectionSchema = SchemaFactory.createForClass(NoteRevisionProjection);

NoteRevisionProjectionSchema.index({ noteId: 1, createdAt: -1 });
