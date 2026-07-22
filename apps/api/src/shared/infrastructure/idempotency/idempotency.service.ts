import { Injectable } from '@nestjs/common';
import { RedisService } from '@shared/infrastructure/redis/redis.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Attempts to acquire an idempotency lock for the given key.
   * Returns true if the key was acquired (it's a new request).
   * Returns false if the key already exists (it's a duplicate request).
   * 
   * @param namespace A domain or feature string to group keys (e.g. 'restore-revision')
   * @param idempotencyKey The unique idempotency key provided by the client
   * @param ttlSeconds Time-to-live in seconds (default: 86400 i.e. 24 hours)
   */
  async checkAndAcquire(namespace: string, idempotencyKey: string, ttlSeconds: number = 86400): Promise<boolean> {
    if (!idempotencyKey) {
      return true; // Bypass if no key is provided
    }

    const lockKey = `idempotency:${namespace}:${idempotencyKey}`;
    const acquired = await this.redisService.getClient().set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
    
    return acquired !== null;
  }
}
