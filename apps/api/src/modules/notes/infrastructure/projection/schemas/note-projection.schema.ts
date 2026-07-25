import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type NoteProjectionDocument = HydratedDocument<NoteProjection>;

@Schema({ collection: 'note_projections', versionKey: false })
export class NoteProjection {
  @Prop({ type: String, required: true })
  declare _id: string;

  @Prop({ type: String, required: true, index: true })
  declare userId: string;

  @Prop({ type: String, required: true })
  declare title: string;

  @Prop({ type: Boolean, required: true, default: false })
  declare isPinned: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  declare isProtected: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  declare isShared: boolean;

  @Prop({ type: [String], default: [] })
  declare labels: string[];

  @Prop({ type: Date, required: true })
  declare createdAt: Date;

  @Prop({ type: Date, required: true })
  declare updatedAt: Date;

  @Prop({
    type: [
      {
        shareId: String,
        recipientId: String,
        recipientEmail: String,
        recipientDisplayName: { type: String, default: null },
        permission: { type: String, enum: ['READ', 'EDIT'] },
        sharedAt: Date,
      },
    ],
    default: [],
  })
  declare shares: Array<{
    shareId: string;
    recipientId: string | null;
    recipientEmail: string;
    recipientDisplayName: string | null;
    permission: 'READ' | 'EDIT';
    sharedAt: Date;
  }>;

  @Prop({ type: Number, required: true, default: 0 })
  declare aggregateVersion: number;

  @Prop({ type: String, required: true, default: '' })
  declare lastEventId: string;

  @Prop({ type: Date, required: true })
  declare projectionUpdatedAt: Date;
}

export const NoteProjectionSchema = SchemaFactory.createForClass(NoteProjection);

NoteProjectionSchema.index({ userId: 1, updatedAt: -1 });
NoteProjectionSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
NoteProjectionSchema.index({ 'shares.recipientId': 1 });
