import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { Notification } from '@prisma/client';
import type { INotificationQueryDao, NotificationView } from '@modules/notifications/application/ports/notification-query.dao.port';

@Injectable()
export class PrismaNotificationQueryDao implements INotificationQueryDao {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string, limit: number, cursor?: string): Promise<NotificationView[]> {
    const raw = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return raw.map(this.mapToView);
  }

  async findUnread(userId: string, limit: number, cursor?: string): Promise<NotificationView[]> {
    const raw = await this.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return raw.map(this.mapToView);
  }

  async countUnread(userId: string): Promise<number> {
    const stat = await this.prisma.userNotificationStat.findUnique({
      where: { userId },
      select: { unreadCount: true },
    });
    return stat?.unreadCount ?? 0;
  }

  private mapToView(raw: Notification): NotificationView {
    return {
      id: raw.id,
      type: raw.type,
      title: raw.title,
      message: raw.message,
      read: raw.read,
      data: raw.data ? (typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data) : undefined,
      createdAt: raw.createdAt.toISOString(),
    };
  }
}
