import { Injectable } from '@nestjs/common';
import type { INotificationRepository } from '../../application/ports/notification.repository.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationEntity } from '../../domain/entities/notification.entity';
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
      data: record.data,
      eventId: record.eventId ?? null,
      createdAt: record.createdAt,
    });
  }

  async save(notification: NotificationEntity): Promise<void> {
    await this.prisma.notification.upsert({
      where: { id: notification.id },
      create: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        data: notification.data,
        eventId: notification.eventId,
        createdAt: notification.createdAt,
      },
      update: {
        read: notification.read,
      },
    });
  }

  async existsByEventId(eventId: string): Promise<boolean> {
    const count = await this.prisma.notification.count({ where: { eventId } });
    return count > 0;
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
    return result.count;
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<NotificationEntity[]> {
    const records = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return records.map(this.toDomain);
  }
}
