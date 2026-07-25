import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import type {
  ShareProjectionEvent,
  NoteSharedProjectionEvent,
  ShareUpdatedProjectionEvent,
  ShareRevokedProjectionEvent,
} from '@modules/notes/infrastructure/projection/events/projection-events';

/**
 * Consumes note share events from Kafka and updates the embedded shares[]
 * subdocument inside note_projections.
 *
 * Topics handled: NoteShared, ShareUpdated, ShareRevoked
 * Consumer group: note-share-projection-cg
 *
 * Also keeps isShared flag in sync with the presence of any shares.
 */
@Injectable()
export class NoteShareProjectionConsumer {
  private readonly logger = new Logger(NoteShareProjectionConsumer.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  async handle(event: ShareProjectionEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'NoteShared':
          await this.onShared(event);
          break;
        case 'ShareUpdated':
          await this.onShareUpdated(event);
          break;
        case 'ShareRevoked':
          await this.onShareRevoked(event);
          break;
      }
    } catch (err) {
      this.logger.error(`Failed to handle ${event.type} for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  private async onShared(event: NoteSharedProjectionEvent): Promise<void> {
    const result = await this.noteModel.updateOne(
      {
        _id: event.aggregateId,
        aggregateVersion: { $lt: event.aggregateVersion },
        lastEventId: { $ne: event.eventId },
        'shares.shareId': { $ne: event.shareId }, // prevent duplicate push
      },
      {
        $push: {
          shares: {
            shareId: event.shareId,
            recipientId: event.recipientId,
            recipientEmail: event.recipientEmail,
            recipientDisplayName: event.recipientDisplayName,
            permission: event.permission,
            sharedAt: new Date(event.sharedAt),
          },
        },
        $set: {
          isShared: true,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      this.logger.debug(`Skipped NoteShared ${event.shareId} (stale or duplicate)`);
    }
  }

  private async onShareUpdated(event: ShareUpdatedProjectionEvent): Promise<void> {
    const result = await this.noteModel.updateOne(
      {
        _id: event.aggregateId,
        aggregateVersion: { $lt: event.aggregateVersion },
        lastEventId: { $ne: event.eventId },
        'shares.shareId': event.shareId,
      },
      {
        $set: {
          'shares.$.permission': event.permission,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      this.logger.debug(`Skipped ShareUpdated ${event.shareId} (stale, duplicate, or share not found)`);
    }
  }

  private async onShareRevoked(event: ShareRevokedProjectionEvent): Promise<void> {
    // Remove the share subdoc then recompute isShared flag
    await this.noteModel.updateOne(
      {
        _id: event.aggregateId,
        aggregateVersion: { $lt: event.aggregateVersion },
        lastEventId: { $ne: event.eventId },
      },
      {
        $pull: { shares: { shareId: event.shareId } },
        $set: {
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
    );

    // Recompute isShared based on remaining shares count
    await this.noteModel.updateOne(
      { _id: event.aggregateId },
      [{ $set: { isShared: { $gt: [{ $size: '$shares' }, 0] } } }],
    );
  }
}
