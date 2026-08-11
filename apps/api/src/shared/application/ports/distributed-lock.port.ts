export const DISTRIBUTED_LOCK_PORT = Symbol('DISTRIBUTED_LOCK_PORT');

export interface IDistributedLockPort {
  /**
   * Attempts to acquire a lock for a given resource.
   * Returns true if acquired, false otherwise.
   * @param resourceKey Unique identifier for the resource.
   * @param ttlSeconds Time-to-live for the lock in seconds.
   */
  acquireLock(resourceKey: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Releases a previously acquired lock.
   */
  releaseLock(resourceKey: string): Promise<void>;
}
