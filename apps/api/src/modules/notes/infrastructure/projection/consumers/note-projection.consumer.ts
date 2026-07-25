import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import type {
  NoteProjectionEvent,
  NoteCreatedProjectionEvent,
  NoteTitleUpdatedProjectionEvent,
  NotePinnedProjectionEvent,
  NoteLabelRenamedProjectionEvent,
  NoteLabelDeletedProjectionEvent,
} from '@modules/notes/infrastructure/projection/events/projection-events';

/**
 * Consumes note lifecycle events from Kafka and upserts the note_projections collection.
 *
 * Topics handled: NoteCreated, NoteDeleted, NoteTitleUpdated,
 *   NoteProtectionSet, NoteProtectionRemoved, NotePinned, NoteLabelRenamed, NoteLabelDeleted
 *
 * Consumer group: note-projection-cg
 *
 * Versioning strategy (mutable documents):
 *   - Guard: { aggregateVersion: { $lt: event.aggregateVersion } }
 *   - If the filter matches nothing (stale or duplicate), update is a no-op
 *   - lastEventId guards exact-duplicate delivery from Kafka at-least-once
 */
@Injectable()
export class NoteProjectionConsumer {
  private readonly logger = new Logger(NoteProjectionConsumer.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  async handle(event: NoteProjectionEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'NoteCreated':
          await this.onCreate(event);
          break;
        case 'NoteDeleted':
          await this.onDelete(event);
          break;
        case 'NoteTitleUpdated':
          await this.onTitleUpdated(event);
          break;
        case 'NoteProtectionSet':
          await this.onProtectionSet(event);
          break;
        case 'NoteProtectionRemoved':
          await this.onProtectionRemoved(event);
          break;
        case 'NotePinned':
          await this.onPinned(event);
          break;
        case 'NoteLabelRenamed':
          await this.onLabelRenamed(event);
          break;
        case 'NoteLabelDeleted':
          await this.onLabelDeleted(event);
          break;
      }
    } catch (err) {
      this.logger.error(`Failed to handle ${event.type} for note ${event.aggregateId}`, err);
      throw err; // re-throw so Kafka consumer offsets are not committed
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  private async onCreate(event: NoteCreatedProjectionEvent): Promise<void> {
    await this.noteModel.updateOne(
      {
        _id: event.aggregateId,
        $or: [
          { aggregateVersion: { $lt: event.aggregateVersion } },
          { aggregateVersion: { $exists: false } },
        ],
      },
      {
        $setOnInsert: {
          _id: event.aggregateId,
          userId: event.userId,
          title: event.title,
          isPinned: false,
          isProtected: false,
          isShared: false,
          labels: [],
          shares: [],
          createdAt: new Date(event.occurredAt),
          updatedAt: new Date(event.occurredAt),
        },
        $set: {
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private async onDelete(event: NoteProjectionEvent): Promise<void> {
    // Guard against out-of-order or redelivered NoteDeleted events
    const result = await this.noteModel.deleteOne({
      _id: event.aggregateId,
      aggregateVersion: { $lt: event.aggregateVersion },
    });

    if (result.deletedCount === 0) {
      this.logger.debug(
        `Skipped NoteDeleted v${event.aggregateVersion} for note ${event.aggregateId} (stale or already deleted)`,
      );
    }
  }

  private async onTitleUpdated(event: NoteTitleUpdatedProjectionEvent): Promise<void> {
    await this.applyGuardedUpdate(event, {
      title: event.title,
      updatedAt: new Date(event.occurredAt),
    });
  }

  private async onProtectionSet(event: NoteProjectionEvent): Promise<void> {
    await this.applyGuardedUpdate(event, { isProtected: true });
  }

  private async onProtectionRemoved(event: NoteProjectionEvent): Promise<void> {
    await this.applyGuardedUpdate(event, { isProtected: false });
  }

  private async onPinned(event: NotePinnedProjectionEvent): Promise<void> {
    await this.applyGuardedUpdate(event, { isPinned: event.isPinned });
  }

  private async onLabelRenamed(event: NoteLabelRenamedProjectionEvent): Promise<void> {
    // Per-user label rename — only affects the specific user's labels array
    await this.noteModel.updateOne(
      { _id: event.aggregateId, userId: event.userId },
      {
        $set: {
          'labels.$[el]': event.newLabel,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
      { arrayFilters: [{ el: event.oldLabel }] },
    );
  }

  private async onLabelDeleted(event: NoteLabelDeletedProjectionEvent): Promise<void> {
    await this.noteModel.updateOne(
      { _id: event.aggregateId, userId: event.userId },
      {
        $pull: { labels: event.label },
        $set: {
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
    );
  }

  // ── Shared guard ──────────────────────────────────────────────────────────

  private async applyGuardedUpdate(
    event: NoteProjectionEvent,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.noteModel.updateOne(
      {
        _id: event.aggregateId,
        aggregateVersion: { $lt: event.aggregateVersion },
        lastEventId: { $ne: event.eventId }, // idempotency guard
      },
      {
        $set: {
          ...patch,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.eventId,
          projectionUpdatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      this.logger.debug(
        `Skipped ${event.type} v${event.aggregateVersion} for note ${event.aggregateId} (stale or duplicate)`,
      );
    }
  }
}
