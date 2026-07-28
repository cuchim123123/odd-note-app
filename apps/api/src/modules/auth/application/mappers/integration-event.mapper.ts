import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import { UserRegisteredDomainEvent } from '@modules/auth/domain/events/user-registered.domain-event';

import type { IDomainEventMapper, OutboxMessageDraft } from '@shared/application/ports/domain-event-mapper.port';

export type AuthIntegrationEventMapper = IDomainEventMapper;

export class DefaultIntegrationEventMapper implements AuthIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      if (event instanceof UserRegisteredDomainEvent) {
        outboxMessages.push({
          type: 'INTEGRATION_EVENT',
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
