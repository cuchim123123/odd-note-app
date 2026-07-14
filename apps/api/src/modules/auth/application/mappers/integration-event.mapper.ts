import type { DomainEvent } from '../../../../common/domain/domain-event';
import { UserRegisteredDomainEvent } from '../../domain/events/user-registered.domain-event';

export type OutboxMessageDraft = {
  topic: string;
  payload: Record<string, unknown>;
};

export interface IntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[];
}

export class DefaultIntegrationEventMapper implements IntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      if (event instanceof UserRegisteredDomainEvent) {
        outboxMessages.push({
          topic: 'UserRegistered',
          payload: {
            userId: event.userId,
            email: event.email,
            occurredOn: event.occurredOn,
          },
        });
      }
      // Add more event mappings here as they are created
    }

    return outboxMessages;
  }
}
