export type IntegrationEventEnvelope<T = Record<string, unknown>> = {
  eventId: string;
  aggregateId: string;
  eventType: string;
  occurredAt: string;
  payload: T;
};
