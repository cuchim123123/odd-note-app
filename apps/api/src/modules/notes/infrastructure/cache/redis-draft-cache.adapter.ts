import { Injectable } from '@nestjs/common';
import { RedisService } from '@shared/infrastructure/redis/redis.service';
import type { IDraftCachePort, NoteDraftDraft } from '@modules/notes/application/ports/draft-cache.port';

@Injectable()
export class RedisDraftCacheAdapter implements IDraftCachePort {
  constructor(private readonly redis: RedisService) {}

  private draftKey(userId: string, noteId: string): string {
    return `draft:${userId}:${noteId}`;
  }

  async getDraft(userId: string, noteId: string): Promise<NoteDraftDraft | null> {
    const value = await this.redis.getClient().get(this.draftKey(userId, noteId));
    if (!value) return null;
    try {
      return JSON.parse(value) as NoteDraftDraft;
    } catch {
      return null;
    }
  }

  async saveDraft(userId: string, noteId: string, title: string, content: string): Promise<void> {
    const draft: NoteDraftDraft = { title, content, updatedAt: new Date().toISOString() };
    await this.redis.getClient().set(this.draftKey(userId, noteId), JSON.stringify(draft));
  }

  async clearDraft(userId: string, noteId: string): Promise<void> {
    await this.redis.getClient().del(this.draftKey(userId, noteId));
  }
}
