import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtConfigModule } from '../../config';
import { AccessTokenGuard } from '../../shared/presentation/http/guards/access-token.guard';

import { NOTIFICATION_REPOSITORY } from './application/ports/notification.repository.port';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository';

// ─── Application: Command Handlers ──────────────────────────────────────────
import { CreateNotificationHandler } from './application/commands/create-notification/create-notification.handler';
import { MarkAsReadHandler } from './application/commands/mark-as-read/mark-as-read.handler';
import { MarkAllAsReadHandler } from './application/commands/mark-all-as-read/mark-all-as-read.handler';
import { DeleteNotificationHandler } from './application/commands/delete-notification/delete-notification.handler';

// ─── Application: Query Handlers ─────────────────────────────────────────────
import { GetNotificationsHandler } from './application/queries/get-notifications/get-notifications.handler';
import { GetUnreadCountHandler } from './application/queries/get-unread-count/get-unread-count.handler';

// ─── Presentation: HTTP Controllers ──────────────────────────────────────────
import { MarkAsReadHttpController } from './presentation/http/commands/mark-as-read.http.controller';
import { MarkAllAsReadHttpController } from './presentation/http/commands/mark-all-as-read.http.controller';
import { DeleteNotificationHttpController } from './presentation/http/commands/delete-notification.http.controller';
import { GetNotificationsHttpController } from './presentation/http/queries/get-notifications.http.controller';
import { GetUnreadCountHttpController } from './presentation/http/queries/get-unread-count.http.controller';

// ─── Presentation: Kafka Consumers ───────────────────────────────────────────
import { NoteSharedConsumer } from './presentation/kafka/note-shared.consumer';

@Module({
  imports: [CqrsModule, PrismaModule, JwtConfigModule],
  providers: [
    AccessTokenGuard,
    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
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
