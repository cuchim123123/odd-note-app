import type { DomainEvent } from '@shared/domain/ddd/domain-event';
import type { IDomainEventMapper, OutboxMessageDraft } from '@shared/application/ports/domain-event-mapper.port';
import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';
import { NoteSharedDomainEvent } from '@modules/notes/domain/events/note-shared.domain-event';
import { NoteCreatedDomainEvent } from '@modules/notes/domain/events/note-created.domain-event';
import { NoteDeletedDomainEvent } from '@modules/notes/domain/events/note-deleted.domain-event';
import { NoteTitleUpdatedDomainEvent } from '@modules/notes/domain/events/note-title-updated.domain-event';

import { NoteShareUpdatedDomainEvent } from '@modules/notes/domain/events/note-share-updated.domain-event';
import { NoteShareRevokedDomainEvent } from '@modules/notes/domain/events/note-share-revoked.domain-event';
import { NotePasswordSetDomainEvent } from '@modules/notes/domain/events/note-password-set.domain-event';
import { NotePasswordRemovedDomainEvent } from '@modules/notes/domain/events/note-password-removed.domain-event';

export type NoteIntegrationEventMapper = IDomainEventMapper;

export interface IDomainEventTranslator<T extends DomainEvent = DomainEvent, P = unknown> {
  supports(event: DomainEvent): boolean;
  translate(event: T): IntegrationEventEnvelope<P>;
}

export class NoteSharedTranslator implements IDomainEventTranslator<NoteSharedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteShared';
  }
  translate(event: NoteSharedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        shareId: event.shareId,
        ownerId: event.ownerId,
        recipientId: event.recipientId,
        permission: event.permission,
      },
    };
  }
}

export class NoteShareUpdatedTranslator implements IDomainEventTranslator<NoteShareUpdatedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteShareUpdated';
  }
  translate(event: NoteShareUpdatedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: 'ShareUpdated', // Mapped to ShareUpdated for Kafka topics
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        shareId: event.shareId,
        permission: event.newPermission,
      },
    };
  }
}

export class NoteShareRevokedTranslator implements IDomainEventTranslator<NoteShareRevokedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteShareRevoked';
  }
  translate(event: NoteShareRevokedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: 'ShareRevoked',
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        shareId: event.shareId,
      },
    };
  }
}

export class NotePasswordSetTranslator implements IDomainEventTranslator<NotePasswordSetDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NotePasswordSet';
  }
  translate(event: NotePasswordSetDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: 'NoteProtectionSet',
      occurredAt: event.occurredOn.toISOString(),
      payload: {},
    };
  }
}

export class NotePasswordRemovedTranslator implements IDomainEventTranslator<NotePasswordRemovedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NotePasswordRemoved';
  }
  translate(event: NotePasswordRemovedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: 'NoteProtectionRemoved',
      occurredAt: event.occurredOn.toISOString(),
      payload: {},
    };
  }
}

export class NoteCreatedTranslator implements IDomainEventTranslator<NoteCreatedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteCreated';
  }
  translate(event: NoteCreatedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        ownerId: event.ownerId,
        title: event.title,
      },
    };
  }
}

export class NoteDeletedTranslator implements IDomainEventTranslator<NoteDeletedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteDeleted';
  }
  translate(event: NoteDeletedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      occurredAt: event.occurredOn.toISOString(),
      payload: {},
    };
  }
}

export class NoteTitleUpdatedTranslator implements IDomainEventTranslator<NoteTitleUpdatedDomainEvent> {
  supports(event: DomainEvent): boolean {
    return event.eventType === 'NoteTitleUpdated';
  }
  translate(event: NoteTitleUpdatedDomainEvent): IntegrationEventEnvelope {
    return {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      occurredAt: event.occurredOn.toISOString(),
      payload: {
        title: event.title,
      },
    };
  }
}

export class DefaultNoteIntegrationEventMapper implements NoteIntegrationEventMapper {
  private readonly translators: IDomainEventTranslator[] = [
    new NoteSharedTranslator(),
    new NoteShareUpdatedTranslator(),
    new NoteShareRevokedTranslator(),
    new NotePasswordSetTranslator(),
    new NotePasswordRemovedTranslator(),
    new NoteCreatedTranslator(),
    new NoteDeletedTranslator(),
    new NoteTitleUpdatedTranslator(),
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
        topic: envelope.eventType, // Topic is named after the canonical integration event type
        payload: envelope,
      });
    }

    return outboxMessages;
  }
}
