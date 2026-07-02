import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtConfigModule } from '../config';
import { AccessTokenGuard } from '../common/guards/access-token.guard';

import { NOTIFICATION_REPOSITORY } from './application/ports/notification.repository.port';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository';

// Controllers
import { GetNotificationsHttpController } from './application/queries/get-notifications/get-notifications.http.controller';
import { GetUnreadCountHttpController } from './application/queries/get-unread-count/get-unread-count.http.controller';
import { MarkAsReadHttpController } from './application/commands/mark-as-read/mark-as-read.http.controller';
import { MarkAllAsReadHttpController } from './application/commands/mark-all-as-read/mark-all-as-read.http.controller';
import { DeleteNotificationHttpController } from './application/commands/delete-notification/delete-notification.http.controller';

// Command Handlers
import { CreateNotificationHandler } from './application/commands/create-notification/create-notification.handler';
import { MarkAsReadHandler } from './application/commands/mark-as-read/mark-as-read.handler';
import { MarkAllAsReadHandler } from './application/commands/mark-all-as-read/mark-all-as-read.handler';
import { DeleteNotificationHandler } from './application/commands/delete-notification/delete-notification.handler';

// Query Handlers
import { GetNotificationsHandler } from './application/queries/get-notifications/get-notifications.handler';
import { GetUnreadCountHandler } from './application/queries/get-unread-count/get-unread-count.handler';

// Event Handlers (Kafka Consumers)
import { NoteSharedConsumer } from './presentation/kafka/note-shared.consumer';

@Module({
  imports: [CqrsModule, PrismaModule, JwtConfigModule],
  providers: [
    AccessTokenGuard,
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    CreateNotificationHandler,
    MarkAsReadHandler,
    MarkAllAsReadHandler,
    DeleteNotificationHandler,
    GetNotificationsHandler,
    GetUnreadCountHandler,
  ],
  controllers: [
    GetNotificationsHttpController,
    GetUnreadCountHttpController,
    MarkAsReadHttpController,
    MarkAllAsReadHttpController,
    DeleteNotificationHttpController,
    NoteSharedConsumer,
  ],
  exports: [],
})
export class NotificationsModule {}

