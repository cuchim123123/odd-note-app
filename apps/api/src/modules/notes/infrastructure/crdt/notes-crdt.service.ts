import { Injectable, Inject } from '@nestjs/common';
import * as Y from 'yjs';
import { RedisStateService } from '@shared/infrastructure/redis/redis-state.service';
import { RedisCacheService } from '@shared/infrastructure/redis/redis-cache.service';
import type { EnvConfig } from '@config/env.validation';

export type CollaborationSnapshot = {
  title: string;
  content: string;
  isPinned: boolean;
  updatedAt: string;
};

export type YDocState = {
  stateVector: number[];
  updates: Array<number[]>;
  timestamp: number;
};

@Injectable()
export class NotesCrdtService {
  constructor(
    private readonly redisState: RedisStateService,
    private readonly redisCache: RedisCacheService,
    @Inject('ENV_CONFIG') private readonly env: EnvConfig,
  ) {}

  collaborationSnapshotKey(noteId: string): string {
    return `collab:note:${noteId}:snapshot`;
  }

  async readCollaborationSnapshot(noteId: string): Promise<CollaborationSnapshot | null> {
    const value = await this.redisCache.getClient().get(this.collaborationSnapshotKey(noteId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as CollaborationSnapshot;
    } catch {
      return null;
    }
  }

  async persistCollaborationSnapshot(noteId: string, title: string, content: string | null, isPinned: boolean, updatedAt: Date): Promise<void> {
    const snapshot: CollaborationSnapshot = {
      title,
      content: content ?? '',
      isPinned,
      updatedAt: updatedAt.toISOString(),
    };

    await this.redisCache.getClient().set(this.collaborationSnapshotKey(noteId), JSON.stringify(snapshot), 'EX', this.env.CACHE_TTL_COLLAB_SNAPSHOT_SECONDS);
  }

  async clearCollaborationSnapshot(noteId: string): Promise<void> {
    await this.redisCache.getClient().del(this.collaborationSnapshotKey(noteId));
  }

  yDocKey(noteId: string): string {
    return `collab:ydoc:${noteId}`;
  }

  async readYDocState(noteId: string): Promise<YDocState | null> {
    try {
      const value = await this.redisState.getClient().get(this.yDocKey(noteId));
      if (!value) {
        return null;
      }

      return JSON.parse(value) as YDocState;
    } catch {
      return null;
    }
  }

  async readYDocContent(noteId: string): Promise<string | null> {
    try {
      const yDocState = await this.readYDocState(noteId);
      if (!yDocState) {
        return null;
      }

      const yDoc = new Y.Doc();
      if (yDocState.updates && yDocState.updates.length > 0) {
        for (const update of yDocState.updates) {
          Y.applyUpdate(yDoc, new Uint8Array(update));
        }
      }

      const yXml = yDoc.getXmlFragment('prosemirror');
      return yXml.toString();
    } catch {
      return null;
    }
  }

  async readYDocStates(noteIds: string[]): Promise<Map<string, YDocState | null>> {
    if (noteIds.length === 0) return new Map();
    
    try {
      const keys = noteIds.map(id => this.yDocKey(id));
      const values = await this.redisState.getClient().mget(...keys);
      
      const result = new Map<string, YDocState | null>();
      for (let i = 0; i < noteIds.length; i++) {
        const id = noteIds[i]!;
        const value = values[i];
        if (value) {
          try {
            result.set(id, JSON.parse(value) as YDocState);
          } catch {
            result.set(id, null);
          }
        } else {
          result.set(id, null);
        }
      }
      return result;
    } catch {
      return new Map(noteIds.map(id => [id, null]));
    }
  }

  async readYDocContents(noteIds: string[]): Promise<Map<string, string | null>> {
    const states = await this.readYDocStates(noteIds);
    const result = new Map<string, string | null>();

    for (const [noteId, yDocState] of states.entries()) {
      if (!yDocState) {
        result.set(noteId, null);
        continue;
      }

      try {
        const yDoc = new Y.Doc();
        if (yDocState.updates && yDocState.updates.length > 0) {
          for (const update of yDocState.updates) {
            Y.applyUpdate(yDoc, new Uint8Array(update));
          }
        }

        const yXml = yDoc.getXmlFragment('prosemirror');
        result.set(noteId, yXml.toString());
      } catch {
        result.set(noteId, null);
      }
    }

    return result;
  }

  async clearYDocState(noteId: string): Promise<void> {
    try {
      await this.redisState.getClient().del(this.yDocKey(noteId));
    } catch {
      // Silently fail
    }
  }
}
