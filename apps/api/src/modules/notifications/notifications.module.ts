import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { JwtConfigModule } from '@config';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';

import { NOTIFICATION_REPOSITORY } from '@modules/notifications/application/ports/notification.repository.port';
import { PrismaNotificationRepository } from '@modules/notifications/infrastructure/persistence/prisma-notification.repository';
import { NOTIFICATION_QUERY_DAO } from '@modules/notifications/application/ports/notification-query.dao.port';
import { PrismaNotificationQueryDao } from '@modules/notifications/infrastructure/persistence/prisma-notification-query.dao';

// ─── Application: Command Handlers ──────────────────────────────────────────
import { CreateNotificationHandler } from '@modules/notifications/application/commands/create-notification/create-notification.handler';
import { MarkAsReadHandler } from '@modules/notifications/application/commands/mark-as-read/mark-as-read.handler';
import { MarkAllAsReadHandler } from '@modules/notifications/application/commands/mark-all-as-read/mark-all-as-read.handler';
import { DeleteNotificationHandler } from '@modules/notifications/application/commands/delete-notification/delete-notification.handler';

// ─── Application: Query Handlers ─────────────────────────────────────────────
import { GetNotificationsHandler } from '@modules/notifications/application/queries/get-notifications/get-notifications.handler';
import { GetUnreadCountHandler } from '@modules/notifications/application/queries/get-unread-count/get-unread-count.handler';

// ─── Presentation: HTTP Controllers ──────────────────────────────────────────
import { MarkAsReadHttpController } from '@modules/notifications/presentation/http/commands/mark-as-read/mark-as-read.http.controller';
import { MarkAllAsReadHttpController } from '@modules/notifications/presentation/http/commands/mark-all-as-read/mark-all-as-read.http.controller';
import { DeleteNotificationHttpController } from '@modules/notifications/presentation/http/commands/delete-notification/delete-notification.http.controller';
import { GetNotificationsHttpController } from '@modules/notifications/presentation/http/queries/get-notifications/get-notifications.http.controller';
import { GetUnreadCountHttpController } from '@modules/notifications/presentation/http/queries/get-unread-count/get-unread-count.http.controller';

// ─── Presentation: Kafka Consumers ───────────────────────────────────────────
import { NoteSharedConsumer } from '@modules/notifications/presentation/kafka/note-shared.consumer';

@Module({
  imports: [CqrsModule, PrismaModule, JwtConfigModule],
  providers: [
    AccessTokenGuard,
    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_QUERY_DAO, useClass: PrismaNotificationQueryDao },
    // ── Application: Command Handlers ─────────────────────────────────────
    CreateNotificationHandler,
    MarkAsReadHandler,
    MarkAllAsReadHandler,
    DeleteNotificationHandler,
    // ── Application: Query Handlers ───────────────────────────────────────
    GetNotificationsHandler,
    GetUnreadCountHandler,
  ],
  controllers: [
    // ── Presentation: HTTP ────────────────────────────────────────────────
    MarkAsReadHttpController,
    MarkAllAsReadHttpController,
    DeleteNotificationHttpController,
    GetNotificationsHttpController,
    GetUnreadCountHttpController,
    // ── Presentation: Kafka ───────────────────────────────────────────────
    NoteSharedConsumer,
  ],
  exports: [],
})
export class NotificationsModule {}
