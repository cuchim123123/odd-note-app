import type { NotificationEntity } from '@modules/notifications/domain/entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface INotificationRepository {
  save(notification: NotificationEntity): Promise<void>;
  findById(id: string): Promise<NotificationEntity | null>;
  delete(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<void>;
}
