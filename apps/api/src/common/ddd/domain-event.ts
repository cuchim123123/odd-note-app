export interface DomainEvent {
  /** Unique identifier for this event occurrence — used for idempotent processing. */
  readonly eventId: string;
  /** ID of the aggregate that raised this event. */
  readonly aggregateId: string;
  /** Discriminator string — enables consumers to deserialize without switch-on-topic. */
  readonly eventType: string;
  /** Wall-clock timestamp of when the event occurred. */
  readonly occurredOn: Date;
}
