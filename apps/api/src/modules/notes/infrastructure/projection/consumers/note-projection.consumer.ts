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
            isPinned: false,
            isProtected: false,
            isShared: false,
            labels: [],
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
  async handleNotePinned(@Payload() event: IntegrationEventEnvelope<{ isPinned: boolean }>): Promise<void> {
    await this.applyGuardedUpdate(event, { isPinned: event.payload.isPinned, updatedAt: new Date(event.occurredAt) });
  }

  @EventPattern('NoteLabelRenamed')
  async handleNoteLabelRenamed(@Payload() event: IntegrationEventEnvelope<{ userId: string; oldLabel: string; newLabel: string }>): Promise<void> {
    try {
      await this.noteModel.updateOne(
        { _id: event.aggregateId, userId: event.payload.userId },
        {
          $set: {
            'labels.$[el]': event.payload.newLabel,
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
            updatedAt: new Date(event.occurredAt),
          },
        },
        { arrayFilters: [{ el: event.payload.oldLabel }] },
      );
    } catch (err) {
      this.logger.error(`Failed to handle NoteLabelRenamed for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteLabelDeleted')
  async handleNoteLabelDeleted(@Payload() event: IntegrationEventEnvelope<{ userId: string; label: string }>): Promise<void> {
    try {
      await this.noteModel.updateOne(
        { _id: event.aggregateId, userId: event.payload.userId },
        {
          $pull: { labels: event.payload.label },
          $set: {
            lastEventId: event.eventId,
            projectionUpdatedAt: new Date(),
            updatedAt: new Date(event.occurredAt),
          },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to handle NoteLabelDeleted for note ${event.aggregateId}`, err);
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
