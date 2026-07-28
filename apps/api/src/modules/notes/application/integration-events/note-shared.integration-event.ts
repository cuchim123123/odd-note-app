/**
 * NoteSharedIntegrationEvent
 *
 * An Integration Event is a cross-process contract published to a message broker
 * (Kafka) for consumption by other services or modules. It is intentionally a
 * plain serialisable DTO — no domain logic, no domain types, no classes with methods.
 *
 * Distinguished from NoteSharedDomainEvent which is:
 *  - In-process only (NestJS EventBus)
 *  - Lives in the domain layer
 *  - May carry domain types (Value Objects, etc.)
 *
 * This integration event lives in the APPLICATION layer because it represents
 * the published contract, not domain state.
 *
 * Kafka topic: 'NoteShared'
 */
export interface NoteSharedIntegrationEvent {
  readonly eventId: string;       // idempotency key (from domain event)
  readonly occurredOn: string;    // ISO-8601
  readonly noteId: string;
  readonly shareId: string;
  readonly ownerId: string;
  readonly recipientId: string;
  readonly permission: string;    // 'READ' | 'EDIT'
}
