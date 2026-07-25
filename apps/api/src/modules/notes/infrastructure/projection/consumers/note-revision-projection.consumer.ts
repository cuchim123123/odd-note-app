import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NoteRevisionProjection, type NoteRevisionProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-revision-projection.schema';
import type { NoteRevisionCreatedProjectionEvent } from '@modules/notes/infrastructure/projection/events/projection-events';

/**
 * Consumes NoteRevisionCreated events and inserts into note_revision_projections.
 *
 * Collection is append-only — documents are never updated after insert.
 * Idempotency is enforced by MongoDB's _id uniqueness (revisionId).
 * No aggregateVersion guard needed per architecture decision.
 *
 * Consumer group: note-revision-projection-cg
 */
@Injectable()
export class NoteRevisionProjectionConsumer {
  private readonly logger = new Logger(NoteRevisionProjectionConsumer.name);

  constructor(
    @InjectModel(NoteRevisionProjection.name)
    private readonly revisionModel: Model<NoteRevisionProjectionDocument>,
  ) {}

  async handle(event: NoteRevisionCreatedProjectionEvent): Promise<void> {
    try {
      await this.revisionModel.create({
        _id: event.revisionId,
        noteId: event.aggregateId,
        targetSeq: event.targetSeq,
        label: event.label,
        createdBy: event.createdBy,
        createdAt: new Date(event.occurredAt),
      });
    } catch (err: unknown) {
      // DuplicateKeyError (code 11000) — already inserted, safe to discard
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        this.logger.debug(`Duplicate NoteRevisionCreated ${event.revisionId} — skipped`);
        return;
      }
      this.logger.error(`Failed to handle NoteRevisionCreated ${event.revisionId}`, err);
      throw err;
    }
  }
}
