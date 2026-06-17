import type { NotificationEntity } from '../../domain/entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface INotificationRepository {
  save(notification: NotificationEntity): Promise<void>;
  findById(id: string): Promise<NotificationEntity | null>;
  delete(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  countUnread(userId: string): Promise<number>;
  findByUserId(userId: string, limit: number, offset: number): Promise<NotificationEntity[]>;
}
