import { Inject, Injectable } from '@nestjs/common';
import type {
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { EnvConfig } from '@config/config.module';

@Injectable()
export class RedisService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly redisClient: Redis;

  constructor(
    @Inject('ENV_CONFIG')
    private readonly env: EnvConfig,
  ) {
    this.redisClient = this.createRedisClient();
  }

  private createRedisClient(): Redis {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    };

    return new Redis(this.env.REDIS_URL, options);
  }

  getClient(): Redis {
    return this.redisClient;
  }

  createClient(): Redis {
    return this.createRedisClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redisClient.quit();
  }
}