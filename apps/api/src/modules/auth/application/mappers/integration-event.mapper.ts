import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import { UserRegisteredDomainEvent } from '@modules/auth/domain/events/user-registered.domain-event';

import type { IDomainEventMapper, OutboxMessageDraft } from '@shared/application/ports/domain-event-mapper.port';

import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

export type AuthIntegrationEventMapper = IDomainEventMapper;

export interface IAuthDomainEventTranslator<T extends DomainEvent = DomainEvent, P = unknown> {
  supports(event: DomainEvent): boolean;
  translate(event: T): IntegrationEventEnvelope<P>;
}

export class UserRegisteredTranslator implements IAuthDomainEventTranslator<UserRegisteredDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'UserRegistered';
  }
  translate(event: UserRegisteredDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.userId, // The user is the aggregate
      eventType: event.eventType,
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        email: event.email,
      },
    };
  }
}

export class DefaultIntegrationEventMapper implements AuthIntegrationEventMapper {
  private readonly translators: IAuthDomainEventTranslator[] = [
    new UserRegisteredTranslator(),
  ];

  map(domainEvents: DomainEvent[]): OutboxMessageDraft[] {
    const outboxMessages: OutboxMessageDraft[] = [];

    for (const event of domainEvents) {
      const translator = this.translators.find((t) => t.supports(event));
      if (!translator) {
        throw new Error(`Integration Event Mapper: No translator found for domain event type '${event.eventType}'. All published domain events must have an explicit translator or be explicitly ignored.`);
      }

      const envelope = translator.translate(event);
      outboxMessages.push({
        type: 'INTEGRATION_EVENT',
        topic: envelope.eventType,
        payload: envelope,
      });
    }

    return outboxMessages;
  }
}
