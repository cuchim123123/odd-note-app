import type { DomainEvent } from '@shared/domain/ddd/domain-event';

export type OutboxMessageType = 'INTEGRATION_EVENT' | 'INTERNAL_COMMAND';

export interface OutboxMessageDraft {
  type: OutboxMessageType;
  topic: string;
  payload: Record<string, unknown>;
}

/**
 * Common interface for mapping domain events to outbox messages.
 * Each bounded context can provide its own implementation.
 */
export interface IDomainEventMapper {
  map(events: DomainEvent[]): OutboxMessageDraft[];
}
