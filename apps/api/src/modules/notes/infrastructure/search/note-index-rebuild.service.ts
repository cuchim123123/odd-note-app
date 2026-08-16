import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { NoteProjection, type NoteProjectionDocument } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import { NOTE_SEARCH_INDEX_PORT } from '@modules/notes/application/ports/external/note-search-index.port';
import type { INoteSearchIndexPort, NoteSearchDocument } from '@modules/notes/application/ports/external/note-search-index.port';

/**
 * Utility service to rebuild the OpenSearch index from MongoDB projections.
 * 
 * This is a one-shot utility, not a background worker. It can be invoked via
 * an admin endpoint or CLI script to backfill search data or recover from
 * projection desyncs.
 */
@Injectable()
export class NoteIndexRebuildService {
  private readonly logger = new Logger(NoteIndexRebuildService.name);

  constructor(
    @InjectModel(NoteProjection.name)
    private readonly noteModel: Model<NoteProjectionDocument>,
    @Inject(NOTE_SEARCH_INDEX_PORT)
    private readonly searchIndex: INoteSearchIndexPort,
  ) {}

  /**
   * Cursor-scans the MongoDB note_projections collection and bulk-upserts all
   * documents to OpenSearch.
   */
  async rebuildIndex(batchSize = 500): Promise<{ processed: number; errors: number }> {
    this.logger.log(`Starting search index rebuild. Batch size: ${batchSize}`);
    
    let processed = 0;
    let errors = 0;
    
    const cursor = this.noteModel.find().cursor();
    let batch: NoteSearchDocument[] = [];
    
    for await (const doc of cursor) {
      try {
        const noteId = doc._id.toString();
        
        // 1. Owner document
        batch.push({
          noteId,
          userId: doc.userId,
          accessMode: 'owner',
          title: doc.title,
          labels: doc.labels ?? [],
          isPinned: doc.isPinned ?? false,
          isProtected: doc.isProtected ?? false,
          isShared: doc.isShared ?? false,
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
        });

        // 2. Sharee documents
        if (doc.shares && Array.isArray(doc.shares)) {
          for (const share of doc.shares) {
            if (share.recipientId) {
              batch.push({
                noteId,
                userId: share.recipientId,
                accessMode: 'shared',
                title: doc.title,
                labels: share.labels ?? [],
                isPinned: share.isPinned ?? false,
                isProtected: doc.isProtected ?? false,
                isShared: true,
                sharedPermission: share.permission,
                updatedAt: doc.updatedAt,
                createdAt: share.sharedAt || doc.createdAt,
              });
            }
          }
        }
        
        if (batch.length >= batchSize) {
          await this.searchIndex.bulkUpsert(batch);
          processed += batch.length;
          this.logger.log(`Processed ${processed} documents...`);
          batch = [];
        }
      } catch (err) {
        this.logger.error(`Error processing note ${doc._id.toString()}`, err);
        errors++;
      }
    }
    
    // Flush remaining
    if (batch.length > 0) {
      try {
        await this.searchIndex.bulkUpsert(batch);
        processed += batch.length;
        this.logger.log(`Processed ${processed} documents...`);
      } catch (err) {
        this.logger.error(`Error processing final batch`, err);
        errors++;
      }
    }
    
    this.logger.log(`Search index rebuild complete. Total processed: ${processed}. Errors: ${errors}`);
    return { processed, errors };
  }
}
