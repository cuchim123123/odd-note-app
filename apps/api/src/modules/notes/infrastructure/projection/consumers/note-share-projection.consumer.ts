import { Controller, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

@Controller()
export class NoteShareProjectionConsumer {
  private readonly logger = new Logger(NoteShareProjectionConsumer.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  @EventPattern('NoteShared')
  async handleNoteShared(@Payload() event: IntegrationEventEnvelope<{
    shareId: string;
    recipientId: string | null;
    recipientEmail?: string;
    recipientDisplayName?: string | null;
    permission: 'READ' | 'EDIT';
  }>): Promise<void> {
    try {
      const result = await this.noteModel.updateOne(
        {
          _id: event.aggregateId,
          lastEventId: { $ne: event.eventId },
          'shares.shareId': { $ne: event.payload.shareId }, // prevent duplicate push
        },
        {
          $push: {
            shares: {
              shareId: event.payload.shareId,
              recipientId: event.payload.recipientId,
              recipientEmail: event.payload.recipientEmail || event.payload.recipientId,
              recipientDisplayName: event.payload.recipientDisplayName || null,
              permission: event.payload.permission,
              sharedAt: new Date(event.occurredAt),
            },
          },
          $set: {
            isShared: true,
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        this.logger.debug(`Skipped NoteShared ${event.payload.shareId} (duplicate or note not found)`);
      }
    } catch (err) {
      this.logger.error(`Failed to handle NoteShared for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('ShareUpdated')
  async handleShareUpdated(@Payload() event: IntegrationEventEnvelope<{ shareId: string; permission: 'READ' | 'EDIT' }>): Promise<void> {
    try {
      const result = await this.noteModel.updateOne(
        {
          _id: event.aggregateId,
          lastEventId: { $ne: event.eventId },
          'shares.shareId': event.payload.shareId,
        },
        {
          $set: {
            'shares.$.permission': event.payload.permission,
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        this.logger.debug(`Skipped ShareUpdated ${event.payload.shareId} (duplicate, or share not found)`);
      }
    } catch (err) {
      this.logger.error(`Failed to handle ShareUpdated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('ShareRevoked')
  async handleShareRevoked(@Payload() event: IntegrationEventEnvelope<{ shareId: string }>): Promise<void> {
    try {
      // Atomic: remove the share AND recompute isShared in one pipeline update
      await this.noteModel.updateOne(
        {
          _id: event.aggregateId,
          lastEventId: { $ne: event.eventId },
        },
        [
          {
            $set: {
              shares: {
                $filter: {
                  input: '$shares',
                  as: 's',
                  cond: { $ne: ['$$s.shareId', event.payload.shareId] },
                },
              },
              lastEventId: event.eventId,
              projectionUpdatedAt: new Date(),
            },
          },
          {
            $set: {
              isShared: { $gt: [{ $size: '$shares' }, 0] },
            },
          },
        ],
      );
    } catch (err) {
      this.logger.error(`Failed to handle ShareRevoked for note ${event.aggregateId}`, err);
      throw err;
    }
  }
}

