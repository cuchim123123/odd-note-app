import { Controller, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { Model } from 'mongoose';
import { NoteRevisionProjection, type NoteRevisionProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-revision-projection.schema';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

@Controller()
export class NoteRevisionProjectionConsumer {
  private readonly logger = new Logger(NoteRevisionProjectionConsumer.name);

  constructor(
    @InjectModel(NoteRevisionProjection.name)
    private readonly revisionModel: Model<NoteRevisionProjectionDocument>,
  ) {}

  @EventPattern('NoteRevisionCreated')
  async handleNoteRevisionCreated(@Payload() event: IntegrationEventEnvelope<{
    revisionId: string;
    targetSeq: string; // BigInt as string
    label: string | null;
    createdBy: string;
  }>): Promise<void> {
    try {
      await this.revisionModel.create({
        _id: event.payload.revisionId,
        noteId: event.aggregateId,
        targetSeq: event.payload.targetSeq,
        label: event.payload.label,
        createdBy: event.payload.createdBy,
        createdAt: new Date(event.occurredAt),
      });
    } catch (err: unknown) {
      // DuplicateKeyError (code 11000) — already inserted, safe to discard
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        this.logger.debug(`Duplicate NoteRevisionCreated ${event.payload.revisionId} — skipped`);
        return;
      }
      this.logger.error(`Failed to handle NoteRevisionCreated ${event.payload.revisionId}`, err);
      throw err;
    }
  }
}
