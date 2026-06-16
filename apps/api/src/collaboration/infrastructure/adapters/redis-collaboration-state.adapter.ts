import { Injectable, Logger } from '@nestjs/common';
import type { ICollaborationStatePort, CollaboratorInfo, TypingInfo } from '../../application/ports/collaboration-state.port';
import { RedisService } from '../../../redis/redis.service';
import { COLLABORATION_TYPING_STALE_AFTER_MS } from '../../collaboration.constants';

@Injectable()
export class RedisCollaborationStateAdapter implements ICollaborationStatePort {
  private readonly logger = new Logger(RedisCollaborationStateAdapter.name);

  constructor(private readonly redisService: RedisService) {}

  private get client() {
    return this.redisService.getClient();
  }

  // Socket -> Room tracking
  async saveSocketRoom(socketId: string, noteId: string, user: CollaboratorInfo): Promise<void> {
    const key = `socket:${socketId}`;
    await this.client.set(key, JSON.stringify({ noteId, user }), 'EX', 3600 * 24); // 24h expiry
  }

  async getSocketRoom(socketId: string): Promise<{ noteId: string; user: CollaboratorInfo } | null> {
    const key = `socket:${socketId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async clearSocketRoom(socketId: string): Promise<void> {
    const key = `socket:${socketId}`;
    await this.client.del(key);
  }

  // Room participants tracking
  async addParticipant(noteId: string, socketId: string, user: CollaboratorInfo): Promise<void> {
    const key = `note:${noteId}:participants`;
    await this.client.hset(key, socketId, JSON.stringify(user));
    await this.client.expire(key, 3600 * 24);
  }

  async removeParticipant(noteId: string, socketId: string): Promise<void> {
    const key = `note:${noteId}:participants`;
    await this.client.hdel(key, socketId);
  }

  async getParticipants(noteId: string): Promise<CollaboratorInfo[]> {
    const key = `note:${noteId}:participants`;
    const data = await this.client.hgetall(key);
    if (!data) return [];

    // Deduplicate by userId
    const uniqueUsers = new Map<string, CollaboratorInfo>();
    for (const jsonStr of Object.values(data)) {
      try {
        const user = JSON.parse(jsonStr) as CollaboratorInfo;
        uniqueUsers.set(user.userId, user);
      } catch {
        // ignore invalid json
      }
    }
    return Array.from(uniqueUsers.values());
  }

  // Typing tracking
  async setTyping(noteId: string, user: CollaboratorInfo): Promise<void> {
    const key = `note:${noteId}:typing`;
    const typingInfo: TypingInfo = { ...user, updatedAt: Date.now() };
    await this.client.hset(key, user.userId, JSON.stringify(typingInfo));
    await this.client.expire(key, Math.ceil(COLLABORATION_TYPING_STALE_AFTER_MS / 1000) * 2);
  }

  async removeTyping(noteId: string, userId: string): Promise<void> {
    const key = `note:${noteId}:typing`;
    await this.client.hdel(key, userId);
  }

  async getTyping(noteId: string): Promise<TypingInfo[]> {
    const key = `note:${noteId}:typing`;
    const data = await this.client.hgetall(key);
    if (!data) return [];

    const now = Date.now();
    const typingUsers: TypingInfo[] = [];

    for (const [userId, jsonStr] of Object.entries(data)) {
      try {
        const info = JSON.parse(jsonStr) as TypingInfo;
        if (now - info.updatedAt < COLLABORATION_TYPING_STALE_AFTER_MS) {
          typingUsers.push(info);
        } else {
          // Cleanup stale typing status
          this.removeTyping(noteId, userId).catch(() => {});
        }
      } catch {
        // ignore invalid json
      }
    }
    return typingUsers;
  }

  // Cursors tracking
  async setCursor(noteId: string, userId: string, cursor: unknown): Promise<void> {
    const key = `note:${noteId}:cursors`;
    await this.client.hset(key, userId, JSON.stringify(cursor));
    await this.client.expire(key, 3600);
  }

  async removeCursor(noteId: string, userId: string): Promise<void> {
    const key = `note:${noteId}:cursors`;
    await this.client.hdel(key, userId);
  }

  async getCursors(noteId: string): Promise<Record<string, unknown>> {
    const key = `note:${noteId}:cursors`;
    const data = await this.client.hgetall(key);
    if (!data) return {};

    const cursors: Record<string, unknown> = {};
    for (const [userId, jsonStr] of Object.entries(data)) {
      try {
        cursors[userId] = JSON.parse(jsonStr);
      } catch {
        // ignore invalid
      }
    }
    return cursors;
  }
}
