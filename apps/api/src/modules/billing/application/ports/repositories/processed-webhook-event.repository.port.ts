export const PROCESSED_WEBHOOK_EVENT_REPOSITORY = Symbol('PROCESSED_WEBHOOK_EVENT_REPOSITORY');

export interface IProcessedWebhookEventRepository {
  /**
   * Attempts to insert a new processed event record.
   * Returns true if the insert succeeded (event is new).
   * Returns false if the eventId already exists (duplicate — skip processing).
   *
   * Must be called FIRST inside the UoW transaction so the idempotency
   * check and all subsequent writes are in the same atomic unit.
   */
  insertIfNotExists(webhookEventId: string, provider: string): Promise<boolean>;
}
