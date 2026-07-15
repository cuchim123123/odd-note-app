import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import type { IYjsDocumentPort } from '@modules/collaboration/application/ports/yjs-document.port';
import { RedisService } from '@infrastructure/redis/redis.service';

type YDocState = {
  stateVector: number[];
  updates: Array<number[]>;
  timestamp?: number;
};

@Injectable()
export class YjsDocumentAdapter implements IYjsDocumentPort {
  private readonly logger = new Logger(YjsDocumentAdapter.name);
  private readonly yDocs = new Map<string, Y.Doc>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly redisService: RedisService) {}

  private get client() {
    return this.redisService.getClient();
  }

  private yDocKey(noteId: string): string {
    return `collab:ydoc:${noteId}`;
  }

  private async getOrCreateYDoc(noteId: string): Promise<Y.Doc> {
    if (this.yDocs.has(noteId)) {
      this.resetCleanupTimer(noteId);
      return this.yDocs.get(noteId)!;
    }

    const yDoc = new Y.Doc();
    const persistedState = await this.readYDocState(noteId);
    if (persistedState && persistedState.updates) {
      try {
        Y.applyUpdate(yDoc, new Uint8Array(persistedState.updates.flat()));
      } catch (error) {
        this.logger.warn(`Failed to apply persisted Yjs state for note ${noteId}: ${String(error)}`);
      }
    }

    this.yDocs.set(noteId, yDoc);
    this.resetCleanupTimer(noteId);
    return yDoc;
  }

  private resetCleanupTimer(noteId: string): void {
    if (this.cleanupTimers.has(noteId)) {
      clearTimeout(this.cleanupTimers.get(noteId));
    }
    
    // Auto-cleanup after 5 minutes of inactivity
    const timer = setTimeout(() => {
      this.destroyDocument(noteId);
    }, 5 * 60 * 1000);
    
    this.cleanupTimers.set(noteId, timer);
  }

  private async persistYDoc(noteId: string, yDoc: Y.Doc): Promise<void> {
    try {
      const state = Y.encodeStateAsUpdate(yDoc);
      await this.client.set(
        this.yDocKey(noteId),
        JSON.stringify({
          stateVector: Array.from(state),
          updates: [Array.from(state)],
          timestamp: Date.now(),
        } as YDocState),
      );
    } catch (error) {
      this.logger.error(`Failed to persist Yjs document for note ${noteId}`, error as Error);
    }
  }

  private async readYDocState(noteId: string): Promise<YDocState | null> {
    try {
      const value = await this.client.get(this.yDocKey(noteId));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.warn(`Failed to read Yjs state for note ${noteId}: ${String(error)}`);
      return null;
    }
  }

  async getStateVector(noteId: string): Promise<Uint8Array | undefined> {
    const doc = await this.getOrCreateYDoc(noteId);
    return Y.encodeStateVector(doc);
  }

  async applyUpdate(noteId: string, update: Uint8Array): Promise<void> {
    const doc = await this.getOrCreateYDoc(noteId);
    Y.applyUpdate(doc, update);
    await this.persistYDoc(noteId, doc);
  }

  async encodeStateAsUpdate(noteId: string, stateVector?: Uint8Array): Promise<Uint8Array | undefined> {
    const doc = await this.getOrCreateYDoc(noteId);
    return Y.encodeStateAsUpdate(doc, stateVector);
  }

  async destroyDocument(noteId: string): Promise<void> {
    const doc = this.yDocs.get(noteId);
    if (doc) {
      doc.destroy();
      this.yDocs.delete(noteId);
      this.logger.debug(`Destroyed Yjs document instance for note ${noteId}`);
    }
    
    const timer = this.cleanupTimers.get(noteId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(noteId);
    }
    
    // Also delete from redis cache when forcefully destroyed (e.g. note deleted)
    await this.client.del(this.yDocKey(noteId));
  }
}
