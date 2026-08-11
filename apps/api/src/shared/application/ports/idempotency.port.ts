export const IDEMPOTENCY_PORT = Symbol('IDEMPOTENCY_PORT');

export interface IIdempotencyPort {
  /**
   * Attempts to acquire an idempotency lock for the given key.
   * Returns true if the key was acquired (it's a new request).
   * Returns false if the key already exists (it's a duplicate request).
   * 
   * @param namespace A domain or feature string to group keys (e.g. 'restore-revision')
   * @param idempotencyKey The unique idempotency key provided by the client
   * @param ttlSeconds Time-to-live in seconds (default: 86400 i.e. 24 hours)
   */
  checkAndAcquire(namespace: string, idempotencyKey: string, ttlSeconds?: number): Promise<boolean>;
}
