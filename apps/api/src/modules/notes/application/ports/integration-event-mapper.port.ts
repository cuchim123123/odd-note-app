import type { DomainEvent } from '../../../../common/domain/domain-event';
import type { OutboxMessageDraft } from '../mappers/integration-event.mapper';

export const NOTE_INTEGRATION_EVENT_MAPPER = Symbol('NOTE_INTEGRATION_EVENT_MAPPER');

export interface INoteIntegrationEventMapper {
  map(domainEvents: DomainEvent[]): OutboxMessageDraft[];
}
