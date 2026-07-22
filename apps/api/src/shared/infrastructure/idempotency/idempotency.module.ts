import { Module } from '@nestjs/common';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [RedisModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
