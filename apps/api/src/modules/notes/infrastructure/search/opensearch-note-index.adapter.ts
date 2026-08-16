import { Injectable, Logger } from '@nestjs/common';
import type { INoteSearchIndexPort, NoteSearchDocument } from '@modules/notes/application/ports/external/note-search-index.port';
import { OpenSearchService } from '@shared/infrastructure/search/opensearch.service';

/**
 * OpenSearch-backed implementation of INoteSearchIndexPort.
 *
 * This is the ONLY place in the codebase that knows about OpenSearch
 * index operations, document IDs, and query DSL for writes.
 *
 * Document ID convention: `{userId}:{noteId}`
 *  - Enables direct-key operations for all events that carry userId/recipientId.
 *  - Provides implicit per-user scoping at the index level.
 */
@Injectable()
export class OpenSearchNoteIndexAdapter implements INoteSearchIndexPort {
  private readonly logger = new Logger(OpenSearchNoteIndexAdapter.name);

  constructor(private readonly search: OpenSearchService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private get index(): string {
    return this.search.indexName('notes');
  }

  private docId(userId: string, noteId: string): string {
    return `${userId}:${noteId}`;
  }

  private toIndexBody(doc: NoteSearchDocument): Record<string, unknown> {
    return {
      noteId: doc.noteId,
      userId: doc.userId,
      accessMode: doc.accessMode,
      title: doc.title,
      ...(doc.bodyText !== undefined && { bodyText: doc.bodyText }),
      labels: doc.labels,
      isPinned: doc.isPinned,
      isProtected: doc.isProtected,
      isShared: doc.isShared,
      ...(doc.sharedPermission !== undefined && { sharedPermission: doc.sharedPermission }),
      updatedAt: doc.updatedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    };
  }

  // ─── INoteSearchIndexPort ─────────────────────────────────────────────────

  async upsert(doc: NoteSearchDocument): Promise<void> {
    const id = this.docId(doc.userId, doc.noteId);
    try {
      await this.search.getClient().index({
        index: this.index,
        id,
        body: this.toIndexBody(doc),
        refresh: 'wait_for',
      });
    } catch (error) {
      this.logger.error(`Failed to upsert search document ${id}`, error);
      throw error;
    }
  }

  async deleteAllForNote(noteId: string): Promise<void> {
    try {
      await this.search.getClient().deleteByQuery({
        index: this.index,
        body: {
          query: {
            // Matches all user documents for this note: "{any-userId}:{noteId}"
            wildcard: { _id: { value: `*:${noteId}` } },
          },
        },
        // Don't block — fire and move on; consistency is eventual
        wait_for_completion: false,
      });
    } catch (error) {
      this.logger.error(`Failed to deleteByQuery for note ${noteId}`, error);
      throw error;
    }
  }

  async updateTitle(noteId: string, title: string, updatedAt: Date): Promise<void> {
    try {
      await this.search.getClient().updateByQuery({
        index: this.index,
        body: {
          query: { wildcard: { _id: { value: `*:${noteId}` } } },
          script: {
            source: 'ctx._source.title = params.title; ctx._source.updatedAt = params.updatedAt;',
            params: { title, updatedAt: updatedAt.toISOString() },
          },
        },
        wait_for_completion: false,
      });
    } catch (error) {
      this.logger.error(`Failed to updateByQuery title for note ${noteId}`, error);
      throw error;
    }
  }

  async updateProtection(noteId: string, isProtected: boolean): Promise<void> {
    try {
      await this.search.getClient().updateByQuery({
        index: this.index,
        body: {
          query: { wildcard: { _id: { value: `*:${noteId}` } } },
          script: {
            source: 'ctx._source.isProtected = params.isProtected;',
            params: { isProtected },
          },
        },
        wait_for_completion: false,
      });
    } catch (error) {
      this.logger.error(`Failed to updateByQuery protection for note ${noteId}`, error);
      throw error;
    }
  }

  /**
   * Direct by-ID update — possible because ShareUpdated now carries recipientId.
   * No query scan needed; O(1) regardless of sharee count.
   */
  async updateSharePermission(
    noteId: string,
    recipientId: string,
    permission: 'READ' | 'EDIT',
  ): Promise<void> {
    const id = this.docId(recipientId, noteId);
    try {
      await this.search.getClient().update({
        index: this.index,
        id,
        body: {
          doc: { sharedPermission: permission },
          doc_as_upsert: false,
        },
      });
    } catch (error) {
      // Document may not yet exist if the search projection is behind.
      // Log and swallow — the NoteShared consumer will create it when it catches up.
      this.logger.warn(`updateSharePermission: document ${id} not found (projection lag?): ${String(error)}`);
    }
  }

  /**
   * Direct by-ID delete — possible because ShareRevoked now carries recipientId.
   */
  async deleteShareeDocument(noteId: string, recipientId: string): Promise<void> {
    const id = this.docId(recipientId, noteId);
    try {
      await this.search.getClient().delete({ index: this.index, id });
    } catch (error) {
      // 404 is safe to ignore — document may have never been indexed
      this.logger.warn(`deleteShareeDocument: document ${id} not found: ${String(error)}`);
    }
  }

  /** Direct by-ID partial update — userId known from event payload. */
  async updatePinStatus(noteId: string, userId: string, isPinned: boolean): Promise<void> {
    const id = this.docId(userId, noteId);
    try {
      await this.search.getClient().update({
        index: this.index,
        id,
        body: { doc: { isPinned } },
      });
    } catch (error) {
      this.logger.warn(`updatePinStatus: document ${id} not found (projection lag?): ${String(error)}`);
    }
  }

  /** Direct by-ID partial update — userId known from event payload. */
  async updateLabels(noteId: string, userId: string, labels: string[]): Promise<void> {
    const id = this.docId(userId, noteId);
    try {
      await this.search.getClient().update({
        index: this.index,
        id,
        body: { doc: { labels } },
      });
    } catch (error) {
      this.logger.warn(`updateLabels: document ${id} not found (projection lag?): ${String(error)}`);
    }
  }

  async updateBodyText(noteId: string, bodyText: string): Promise<void> {
    try {
      await this.search.getClient().updateByQuery({
        index: this.index,
        body: {
          query: { wildcard: { _id: { value: `*:${noteId}` } } },
          script: {
            source: 'ctx._source.bodyText = params.bodyText;',
            params: { bodyText },
          },
        },
        wait_for_completion: false,
      });
    } catch (error) {
      this.logger.error(`Failed to updateByQuery bodyText for note ${noteId}`, error);
      throw error;
    }
  }

  async bulkUpsert(docs: NoteSearchDocument[]): Promise<void> {
    if (docs.length === 0) return;

    const operations = docs.flatMap((doc) => [
      { index: { _index: this.index, _id: this.docId(doc.userId, doc.noteId) } },
      this.toIndexBody(doc),
    ]);

    try {
      const { body: result } = await this.search.getClient().bulk({ body: operations, refresh: 'false' });

      if (result.errors) {
        const failed = (result.items as Array<Record<string, { error?: unknown }>>) 
          .filter((item) => item['index']?.error)
          .map((item) => item['index']?.error);
        this.logger.error(`bulkUpsert: ${failed.length} of ${docs.length} documents failed`, failed);
      }
    } catch (error) {
      this.logger.error(`bulkUpsert failed for ${docs.length} documents`, error);
      throw error;
    }
  }
}
