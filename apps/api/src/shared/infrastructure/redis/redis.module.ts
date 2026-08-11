import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { RedisService } from '@shared/infrastructure/redis/redis.service';

import { DISTRIBUTED_LOCK_PORT } from '@shared/application/ports/distributed-lock.port';
import { RedisDistributedLockAdapter } from '@shared/infrastructure/redis/redis-distributed-lock.adapter';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    { provide: DISTRIBUTED_LOCK_PORT, useClass: RedisDistributedLockAdapter },
  ],
  exports: [RedisService, DISTRIBUTED_LOCK_PORT],
})
export class RedisModule {}
