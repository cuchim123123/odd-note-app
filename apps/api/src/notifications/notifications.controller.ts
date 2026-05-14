import { Controller, Get, Post, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { NotificationResponse } from './notifications.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @CurrentUser() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: NotificationResponse[]; unreadCount: number }> {
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const [notifications, unreadCount] = await Promise.all([
      this.notificationsService.getUserNotifications(userId, limitNum, offsetNum),
      this.notificationsService.getUnreadCount(userId),
    ]);

    return { data: notifications, unreadCount };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount };
  }

  @Post(':id/read')
  async markAsRead(
    @CurrentUser() userId: string,
    @Param('id') notificationId: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() userId: string): Promise<{ markedCount: number }> {
    const markedCount = await this.notificationsService.markAllAsRead(userId);
    return { markedCount };
  }

  @Delete(':id')
  async deleteNotification(
    @CurrentUser() userId: string,
    @Param('id') notificationId: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.deleteNotification(userId, notificationId);
    return { success: true };
  }
}
