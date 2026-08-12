import { Controller, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

@Controller()
export class NoteProjectionConsumer {
  private readonly logger = new Logger(NoteProjectionConsumer.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
  ) {}

  @EventPattern('NoteCreated')
  async handleNoteCreated(@Payload() event: IntegrationEventEnvelope<{ ownerId: string; title: string }>): Promise<void> {
    try {
      await this.noteModel.updateOne(
        { _id: event.aggregateId },
        {
          $setOnInsert: {
            _id: event.aggregateId,
            userId: event.payload.ownerId,
            title: event.payload.title,
            isProtected: false,
            isShared: false,
            pinnedBy: [],
            userLabels: [],
            shares: [],
            createdAt: new Date(event.occurredAt),
          },
          $set: {
            updatedAt: new Date(event.occurredAt),
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error(`Failed to handle NoteCreated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteDeleted')
  async handleNoteDeleted(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    try {
      const result = await this.noteModel.deleteOne({ _id: event.aggregateId });
      if (result.deletedCount === 0) {
        this.logger.debug(`Skipped NoteDeleted for note ${event.aggregateId} (already deleted)`);
      }
    } catch (err) {
      this.logger.error(`Failed to handle NoteDeleted for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteTitleUpdated')
  async handleNoteTitleUpdated(@Payload() event: IntegrationEventEnvelope<{ title: string }>): Promise<void> {
    await this.applyGuardedUpdate(event, {
      title: event.payload.title,
      updatedAt: new Date(event.occurredAt),
    });
  }

  @EventPattern('NoteProtectionSet')
  async handleNoteProtectionSet(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    await this.applyGuardedUpdate(event, { isProtected: true, updatedAt: new Date(event.occurredAt) });
  }

  @EventPattern('NoteProtectionRemoved')
  async handleNoteProtectionRemoved(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    await this.applyGuardedUpdate(event, { isProtected: false, updatedAt: new Date(event.occurredAt) });
  }

  @EventPattern('NotePinned')
  async handleNotePinned(@Payload() event: IntegrationEventEnvelope<{ userId: string; isPinned: boolean }>): Promise<void> {
    try {
      const updateOp = event.payload.isPinned
        ? { $addToSet: { pinnedBy: event.payload.userId } }
        : { $pull: { pinnedBy: event.payload.userId } };

      await this.noteModel.updateOne(
        { _id: event.aggregateId, lastEventId: { $ne: event.eventId } },
        {
          ...updateOp,
          $set: {
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
            updatedAt: new Date(event.occurredAt),
          },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to handle NotePinned for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteLabelsUpdated')
  async handleNoteLabelsUpdated(@Payload() event: IntegrationEventEnvelope<{ userId: string; labels: string[] }>): Promise<void> {
    try {
      // First, ensure the user object exists in userLabels
      await this.noteModel.updateOne(
        { _id: event.aggregateId, 'userLabels.userId': { $ne: event.payload.userId } },
        { $push: { userLabels: { userId: event.payload.userId, labels: [] } } }
      );

      // Then update the labels
      await this.noteModel.updateOne(
        { _id: event.aggregateId, 'userLabels.userId': event.payload.userId },
        {
          $set: {
            'userLabels.$.labels': event.payload.labels,
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
            updatedAt: new Date(event.occurredAt),
          },
        }
      );
    } catch (err) {
      this.logger.error(`Failed to handle NoteLabelsUpdated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ── Shared guard ──────────────────────────────────────────────────────────

  private async applyGuardedUpdate(
    event: IntegrationEventEnvelope,
    patch: Record<string, unknown>,
  ): Promise<void> {
    try {
      const result = await this.noteModel.updateOne(
        {
          _id: event.aggregateId,
          lastEventId: { $ne: event.eventId }, // idempotency guard
        },
        {
          $set: {
            ...patch,
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        this.logger.debug(
          `Skipped ${event.eventType} for note ${event.aggregateId} (duplicate or not found)`,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to apply guarded update for ${event.eventType} on note ${event.aggregateId}`, err);
      throw err;
    }
  }
}
