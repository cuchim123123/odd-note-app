import type { NotificationEntity } from '../../domain/entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface INotificationRepository {
  save(notification: NotificationEntity): Promise<void>;
  findById(id: string): Promise<NotificationEntity | null>;
  /** Idempotency check: returns true if a notification for this eventId already exists. */
  existsByEventId(eventId: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  countUnread(userId: string): Promise<number>;
  findByUserId(userId: string, limit: number, offset: number): Promise<NotificationEntity[]>;
}
