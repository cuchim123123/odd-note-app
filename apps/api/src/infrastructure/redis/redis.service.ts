import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { EnvConfig } from '../../config/config.module';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;

  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {
    this.redisClient = new Redis(this.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  getClient(): Redis {
    return this.redisClient;
  }

  createClient(): Redis {
    return new Redis(this.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }
}
