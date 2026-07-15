import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ConfigModule } from './config/config.module';
import { JwtConfigModule } from './config/jwt-config.module';
import { HealthModule } from './health/health.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { OutboxModule } from './shared/infrastructure/outbox/outbox.module';

@Module({
  imports: [ConfigModule, JwtConfigModule, HealthModule, PrismaModule, RedisModule, AuthModule, UploadsModule, NotesModule, NotificationsModule, CollaborationModule, OutboxModule],
})
export class AppModule {}
