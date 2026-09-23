import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NOTE_SEARCH_INDEX_PORT } from '@modules/notes/application/ports/external/note-search-index.port';
import type { INoteSearchIndexPort } from '@modules/notes/application/ports/external/note-search-index.port';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

/**
 * Kafka consumer that maintains the OpenSearch search index.
 *
 * This is the third read model alongside MongoDB projections.
 * It consumes the same Kafka integration events as the projection consumers
 * and writes to OpenSearch through INoteSearchIndexPort.
 *
 * Idempotency strategy:
 *  - Upsert operations (NoteCreated, NoteShared) are naturally idempotent
 *    by document ID.
 *  - update_by_query / delete_by_query operations are also idempotent
 *    (applying the same value twice has no net effect).
 *  - Direct-key updates (ShareUpdated, ShareRevoked) are idempotent
 *    by target document ID.
 *
 * Error handling: re-throws all errors so the Kafka consumer can retry.
 * The adapter layer swallows 404s for eventual-consistency cases only.
 */
@Controller()
export class NoteSearchIndexConsumer {
  private readonly logger = new Logger(NoteSearchIndexConsumer.name);

  constructor(
    @Inject(NOTE_SEARCH_INDEX_PORT)
    private readonly searchIndex: INoteSearchIndexPort,
  ) {}

  // ─── Note lifecycle ───────────────────────────────────────────────────────

  @EventPattern('NoteCreated')
  async handleNoteCreated(
    @Payload()
    event: IntegrationEventEnvelope<{ ownerId: string; title: string }>,
  ): Promise<void> {
    try {
      await this.searchIndex.upsert({
        noteId: event.aggregateId,
        userId: event.payload.ownerId,
        accessMode: 'owner',
        title: event.payload.title,
        labels: [],
        isPinned: false,
        isProtected: false,
        isShared: false,
        updatedAt: new Date(event.occurredAt),
        createdAt: new Date(event.occurredAt),
      });
    } catch (err) {
      this.logger.error(`Failed to index NoteCreated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteDeleted')
  async handleNoteDeleted(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    try {
      // Deletes the owner document AND all sharee documents for this note.
      // deleteAllForNote uses delete_by_query scoped to noteId — the only
      // justified use of delete_by_query in this consumer because the Kafka
      // payload does not carry sharee IDs.
      await this.searchIndex.deleteAllForNote(event.aggregateId);
    } catch (err) {
      this.logger.error(`Failed to delete search documents for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ─── Metadata updates ─────────────────────────────────────────────────────

  @EventPattern('NoteTitleUpdated')
  async handleNoteTitleUpdated(
    @Payload() event: IntegrationEventEnvelope<{ title: string }>,
  ): Promise<void> {
    try {
      await this.searchIndex.updateTitle(
        event.aggregateId,
        event.payload.title,
        new Date(event.occurredAt),
      );
    } catch (err) {
      this.logger.error(`Failed to update search title for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteProtectionSet')
  async handleNoteProtectionSet(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    try {
      await this.searchIndex.updateProtection(event.aggregateId, true);
    } catch (err) {
      this.logger.error(`Failed to set search protection for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteProtectionRemoved')
  async handleNoteProtectionRemoved(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    try {
      await this.searchIndex.updateProtection(event.aggregateId, false);
    } catch (err) {
      this.logger.error(`Failed to remove search protection for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ─── AI Pipeline updates ──────────────────────────────────────────────────

  @EventPattern('NoteEmbeddingGenerated')
  async handleNoteEmbeddingGenerated(
    @Payload() event: IntegrationEventEnvelope<{ embedding: number[]; snapshotSeq: string }>,
  ): Promise<void> {
    try {
      await this.searchIndex.updateEmbedding(
        event.aggregateId,
        event.payload.embedding,
        BigInt(event.payload.snapshotSeq)
      );
    } catch (err) {
      this.logger.error(`Failed to update embedding for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteAITagsUpdated')
  async handleNoteAITagsUpdated(
    @Payload() event: IntegrationEventEnvelope<{ aiTags: string[]; snapshotSeq: string }>,
  ): Promise<void> {
    try {
      await this.searchIndex.updateAITags(
        event.aggregateId,
        event.payload.aiTags,
        BigInt(event.payload.snapshotSeq)
      );
    } catch (err) {
      this.logger.error(`Failed to update AI tags for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ─── User preferences ─────────────────────────────────────────────────────
  // These update only the owner's document (isPinned/labels are per-user;
  // sharee preferences are stored in the MongoDB projection's shares[] array
  // and are not part of the search index document — search scoping is per-user).

  @EventPattern('NotePinned')
  async handleNotePinned(
    @Payload() event: IntegrationEventEnvelope<{ userId: string; isPinned: boolean }>,
  ): Promise<void> {
    try {
      // Direct by-ID: userId is in the event payload — no scan needed.
      await this.searchIndex.updatePinStatus(
        event.aggregateId,
        event.payload.userId,
        event.payload.isPinned,
      );
    } catch (err) {
      this.logger.error(`Failed to handle NotePinned for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('NoteLabelsUpdated')
  async handleNoteLabelsUpdated(
    @Payload() event: IntegrationEventEnvelope<{ userId: string; labels: string[] }>,
  ): Promise<void> {
    try {
      // Direct by-ID: userId is in the event payload — no scan needed.
      await this.searchIndex.updateLabels(
        event.aggregateId,
        event.payload.userId,
        event.payload.labels,
      );
    } catch (err) {
      this.logger.error(`Failed to handle NoteLabelsUpdated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  // ─── Sharing ──────────────────────────────────────────────────────────────

  @EventPattern('NoteShared')
  async handleNoteShared(
    @Payload()
    event: IntegrationEventEnvelope<{
      shareId: string;
      ownerId: string;
      recipientId: string;
      permission: 'READ' | 'EDIT';
      title: string;
    }>,
  ): Promise<void> {
    try {
      // Fetch the owner document to copy over semantic/search state
      const ownerDoc = await this.searchIndex.getOwnerDocument(event.aggregateId);

      // Create a per-user search document for the sharee.
      // The ownerId's document already exists; this adds the sharee's document.
      // If the owner document had bodyText or embeddings from a snapshot,
      // copy them over so the sharee immediately has full search capabilities.
      await this.searchIndex.upsert({
        noteId: event.aggregateId,
        userId: event.payload.recipientId,
        accessMode: 'shared',
        title: event.payload.title,
        ...(ownerDoc?.bodyText !== undefined && { bodyText: ownerDoc.bodyText }),
        ...(ownerDoc?.embedding !== undefined && { embedding: ownerDoc.embedding }),
        ...(ownerDoc?.aiTags !== undefined && { aiTags: ownerDoc.aiTags }),
        ...(ownerDoc?.snapshotSeq !== undefined && { snapshotSeq: ownerDoc.snapshotSeq }),
        labels: [],
        isPinned: false,
        isProtected: false,
        isShared: true,
        sharedPermission: event.payload.permission,
        updatedAt: new Date(event.occurredAt),
        createdAt: new Date(event.occurredAt),
      });
    } catch (err) {
      this.logger.error(`Failed to index NoteShared for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('ShareUpdated')
  async handleShareUpdated(
    @Payload()
    event: IntegrationEventEnvelope<{
      shareId: string;
      permission: 'READ' | 'EDIT';
      recipientId: string;
    }>,
  ): Promise<void> {
    try {
      // Direct by-ID: recipientId is now in the payload (Phase 0 fix).
      await this.searchIndex.updateSharePermission(
        event.aggregateId,
        event.payload.recipientId,
        event.payload.permission,
      );
    } catch (err) {
      this.logger.error(`Failed to handle ShareUpdated for note ${event.aggregateId}`, err);
      throw err;
    }
  }

  @EventPattern('ShareRevoked')
  async handleShareRevoked(
    @Payload()
    event: IntegrationEventEnvelope<{
      shareId: string;
      recipientId: string;
    }>,
  ): Promise<void> {
    try {
      // Direct by-ID: recipientId is now in the payload (Phase 0 fix).
      await this.searchIndex.deleteShareeDocument(event.aggregateId, event.payload.recipientId);
    } catch (err) {
      this.logger.error(`Failed to handle ShareRevoked for note ${event.aggregateId}`, err);
      throw err;
    }
  }
}
