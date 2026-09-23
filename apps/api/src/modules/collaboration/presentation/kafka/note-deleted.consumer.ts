import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';
import { RedisStateService } from '@shared/infrastructure/redis/redis-state.service';
import { REDIS_CHANNELS, REDIS_EVENT_TYPES } from '@modules/collaboration/collaboration.constants';

@Controller()
export class NoteDeletedConsumer {
  private readonly logger = new Logger(NoteDeletedConsumer.name);

  constructor(private readonly redis: RedisStateService) {}

  @EventPattern('NoteDeleted')
  async handleNoteDeleted(@Payload() event: IntegrationEventEnvelope): Promise<void> {
    this.logger.log(`Handling NoteDeleted Kafka event for note: ${event.aggregateId}`);
    
    try {
      // Publish to the internal Redis channel so the Collaboration Gateway
      // can tear down the CRDT document and evict all active WS clients.
      await this.redis.getClient().publish(
        REDIS_CHANNELS.COLLABORATION_EVENTS,
        JSON.stringify({
          type: REDIS_EVENT_TYPES.NOTE_DELETED,
          noteId: event.aggregateId,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to publish note_deleted event to Redis for note ${event.aggregateId}`, err);
      throw err;
    }
  }
}
