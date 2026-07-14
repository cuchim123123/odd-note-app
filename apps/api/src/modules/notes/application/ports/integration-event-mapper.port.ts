import type { DomainEvent } from '../../../../shared/domain/ddd/domain-event';
import type { OutboxMessageDraft } from '../mappers/integration-event.mapper';

export const NOTE_INTEGRATION_EVENT_MAPPER = Symbol('NOTE_INTEGRATION_EVENT_MAPPER');

export interface INoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[];
}
