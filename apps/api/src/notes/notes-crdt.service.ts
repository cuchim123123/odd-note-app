import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { RedisService } from '../redis/redis.service';

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
  constructor(private readonly redis: RedisService) {}

  collaborationSnapshotKey(noteId: string): string {
    return `collab:note:${noteId}:snapshot`;
  }

  async readCollaborationSnapshot(noteId: string): Promise<CollaborationSnapshot | null> {
    const value = await this.redis.getClient().get(this.collaborationSnapshotKey(noteId));
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

    await this.redis.getClient().set(this.collaborationSnapshotKey(noteId), JSON.stringify(snapshot));
  }

  async clearCollaborationSnapshot(noteId: string): Promise<void> {
    await this.redis.getClient().del(this.collaborationSnapshotKey(noteId));
  }

  yDocKey(noteId: string): string {
    return `collab:ydoc:${noteId}`;
  }

  async readYDocState(noteId: string): Promise<YDocState | null> {
    try {
      const value = await this.redis.getClient().get(this.yDocKey(noteId));
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

  async clearYDocState(noteId: string): Promise<void> {
    try {
      await this.redis.getClient().del(this.yDocKey(noteId));
    } catch {
      // Silently fail
    }
  }
}
