import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../../prisma/prisma.module';
import { KafkaConfigModule } from '../../../config/kafka-config.module';
import { OutboxProcessor } from './outbox.processor';

/**
 * OutboxModule — shared infrastructure module.
 *
 * Provides the generic OutboxProcessor which polls the outbox table
 * and dispatches messages. Domain-specific handlers are registered by
 * each bounded context module via the INTERNAL_COMMAND_HANDLERS
 * multi-provider token.
 *
 * Usage: import OutboxModule in AppModule (or any root module).
 */
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, KafkaConfigModule],
  providers: [OutboxProcessor],
  exports: [OutboxProcessor],
})
export class OutboxModule {}
