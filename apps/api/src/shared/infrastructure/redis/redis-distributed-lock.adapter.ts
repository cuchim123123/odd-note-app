import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import type { IDistributedLockPort } from '@shared/application/ports/distributed-lock.port';

@Injectable()
export class RedisDistributedLockAdapter implements IDistributedLockPort {
  constructor(private readonly redisService: RedisService) {}

  async acquireLock(resourceKey: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `lock:${resourceKey}`;
    const acquired = await this.redisService.getClient().set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
    return acquired !== null;
  }

  async releaseLock(resourceKey: string): Promise<void> {
    const lockKey = `lock:${resourceKey}`;
    await this.redisService.getClient().del(lockKey);
  }
}
