import { Module } from '@nestjs/common';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { IdempotencyService } from './idempotency.service';

import { IDEMPOTENCY_PORT } from '@shared/application/ports/idempotency.port';

@Module({
  imports: [RedisModule],
  providers: [
    IdempotencyService,
    { provide: IDEMPOTENCY_PORT, useClass: IdempotencyService },
  ],
  exports: [IdempotencyService, IDEMPOTENCY_PORT],
})
export class IdempotencyModule {}
