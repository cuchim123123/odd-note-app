import { Module } from '@nestjs/common';
import type { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { CollaborationModule } from '@modules/collaboration/collaboration.module';
import { ConfigModule } from '@config/config.module';
import { JwtConfigModule } from '@config/jwt-config.module';
import { HealthModule } from './health/health.module';
import { NotesModule } from '@modules/notes/notes.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { MongoModule } from '@shared/infrastructure/mongo/mongo.module';
import { UploadsModule } from '@modules/uploads/uploads.module';
import { OutboxModule } from '@shared/infrastructure/outbox/outbox.module';
import { BillingModule } from '@modules/billing/billing.module';
import { CorrelationIdMiddleware } from '@shared/presentation/http/middleware/correlation-id.middleware';

@Module({
  imports: [ConfigModule, JwtConfigModule, HealthModule, PrismaModule, RedisModule, MongoModule.forRoot(), AuthModule, UploadsModule, NotesModule, NotificationsModule, CollaborationModule, OutboxModule, BillingModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
