import { Controller, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

@Controller()
export class NotePreferenceProjectionConsumer {
  private readonly logger = new Logger(NotePreferenceProjectionConsumer.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  @EventPattern('NotePinned')
  async handleNotePinned(@Payload() event: IntegrationEventEnvelope<{ userId: string; isPinned: boolean }>): Promise<void> {
    try {
      const note = await this.noteModel.findOne({ _id: event.aggregateId });
      if (!note) return;

      if (note.userId === event.payload.userId) {
        note.isPinned = event.payload.isPinned;
      } else {
        const share = note.shares.find(s => s.recipientId === event.payload.userId);
        if (share) {
          share.isPinned = event.payload.isPinned;
        }
      }
      note.projectionUpdatedAt = new Date();
      await note.save();
    } catch (err) {
      this.logger.error(`Failed to handle NotePinned for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteLabelsUpdated')
  async handleNoteLabelsUpdated(@Payload() event: IntegrationEventEnvelope<{ userId: string; labels: string[] }>): Promise<void> {
    try {
      const note = await this.noteModel.findOne({ _id: event.aggregateId });
      if (!note) return;

      if (note.userId === event.payload.userId) {
        note.labels = event.payload.labels;
      } else {
        const share = note.shares.find(s => s.recipientId === event.payload.userId);
        if (share) {
          share.labels = event.payload.labels;
        }
      }
      note.projectionUpdatedAt = new Date();
      await note.save();
    } catch (err) {
      this.logger.error(`Failed to handle NoteLabelsUpdated for note ${event.aggregateId}`, err);
      throw err;
    }
  }
}
