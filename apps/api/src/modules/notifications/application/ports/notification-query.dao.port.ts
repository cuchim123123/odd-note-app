export const NOTIFICATION_QUERY_DAO = Symbol('NOTIFICATION_QUERY_DAO');

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface INotificationQueryDao {
  /** Retrieves paginated notifications for a user */
  findByUserId(userId: string, limit: number, cursor?: string): Promise<NotificationView[]>;
  
  /** Retrieves paginated unread notifications for a user */
  findUnread(userId: string, limit: number, cursor?: string): Promise<NotificationView[]>;
  
  /** Retrieves the total count of unread notifications for a user */
  countUnread(userId: string): Promise<number>;
}
