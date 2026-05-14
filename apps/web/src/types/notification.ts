export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, string | number | boolean | object>;
  createdAt: string;
};

export type NotificationListResponse = {
  data: Notification[];
  unreadCount: number;
};

export type UnreadCountResponse = {
  unreadCount: number;
};
