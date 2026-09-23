import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { RedisStateService } from '@shared/infrastructure/redis/redis-state.service';
import { RedisCacheService } from '@shared/infrastructure/redis/redis-cache.service';

import { DISTRIBUTED_LOCK_PORT } from '@shared/application/ports/distributed-lock.port';
import { RedisDistributedLockAdapter } from '@shared/infrastructure/redis/redis-distributed-lock.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisStateService,
    RedisCacheService,
    { provide: DISTRIBUTED_LOCK_PORT, useClass: RedisDistributedLockAdapter },
  ],
  exports: [RedisStateService, RedisCacheService, DISTRIBUTED_LOCK_PORT],
})
export class RedisModule {}
