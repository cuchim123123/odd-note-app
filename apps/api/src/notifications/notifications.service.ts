import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationResponse = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, string | number | boolean | object>;
  createdAt: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string, limit = 50, offset = 0): Promise<NotificationResponse[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      data: notification.data ? JSON.parse(notification.data) : undefined,
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.update({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: { read: true },
    });

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      data: notification.data ? JSON.parse(notification.data) : undefined,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.delete({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });

    return result.count;
  }
}
