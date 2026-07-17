import { Injectable } from '@nestjs/common';
import type { INotificationRepository } from '@modules/notifications/application/ports/notification.repository.port';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NotificationEntity } from '@modules/notifications/domain/entities/notification.entity';
import type { Notification } from '@prisma/client';

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(record: Notification): NotificationEntity {
    return NotificationEntity.reconstitute(record.id, {
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      read: record.read,
      data: record.data ? JSON.parse(record.data) as Record<string, unknown> : null,
      eventId: record.eventId ?? null,
      createdAt: record.createdAt,
    });
  }

  async save(notification: NotificationEntity): Promise<void> {
    // Idempotent insert, wont return anything on duplicate.
    const result = await this.prisma.notification.createMany({
      data: [{
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        data: notification.data ? JSON.stringify(notification.data) : null,
        eventId: notification.eventId,
        createdAt: notification.createdAt,
      }],
      skipDuplicates: true,
    });
    
    // Idempotent
    // Success (count > 0) means no duplicate,
    if (result.count > 0 && !notification.read) {
      await this.prisma.userNotificationStat.upsert({
        where: { userId: notification.userId },
        create: { userId: notification.userId, unreadCount: 1 },
        update: { unreadCount: { increment: 1 } },
      });
    }
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const record = await this.prisma.notification.findUnique({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notification.delete({ where: { id } });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    
    if (result.count > 0) {
      await this.prisma.userNotificationStat.upsert({
        where: { userId },
        create: { userId, unreadCount: 0 },
        update: { unreadCount: 0 },
      });
    }
    
    return result.count;
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, read: false },
      data: { read: true },
    });
    
    if (result.count > 0) {
      await this.prisma.userNotificationStat.updateMany({
        where: { userId, unreadCount: { gt: 0 } },
        data: { unreadCount: { decrement: 1 } },
      });
    }
  }

  async countUnread(userId: string): Promise<number> {
    const stat = await this.prisma.userNotificationStat.findUnique({
      where: { userId },
    });
    return stat?.unreadCount ?? 0;
  }

  async findByUserId(userId: string, limit: number, cursor?: string): Promise<NotificationEntity[]> {
    const records = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { id: 'desc' }, // uuid(7) is chronologically sortable
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return records.map((r) => this.toDomain(r));
  }

  async findUnread(userId: string, limit: number, cursor?: string): Promise<NotificationEntity[]> {
    const records = await this.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { id: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return records.map((r) => this.toDomain(r));
  }
}
