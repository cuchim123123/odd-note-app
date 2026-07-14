import { EventBus } from '@nestjs/cqrs';
import type { AggregateRoot } from './aggregate-root';

/**
 * Dispatches all accumulated domain events from an aggregate root through
 * the NestJS in-process EventBus, then clears the event queue.
 *
 * Usage in command handlers:
 *   await dispatchDomainEvents(aggregate, this.eventBus);
 *
 * Per domain-driven-hexagon: domain events are for in-process reactive logic
 * within the same bounded context. Cross-process publishing (Kafka) is handled
 * separately by the Outbox pattern via INoteOutboxPort.
 */
export async function dispatchDomainEvents(
  aggregate: AggregateRoot,
  eventBus: EventBus,
): Promise<void> {
  const events = [...aggregate.domainEvents];
  aggregate.clearDomainEvents();
  for (const event of events) {
    await eventBus.publish(event);
  }
}
