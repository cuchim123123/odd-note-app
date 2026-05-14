import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { ConfigModule } from './config/config.module';
import { JwtConfigModule } from './config/jwt-config.module';
import { HealthModule } from './health/health.module';
import { NotesModule } from './notes/notes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [ConfigModule, JwtConfigModule, HealthModule, PrismaModule, RedisModule, AuthModule, UploadsModule, NotesModule, NotificationsModule, CollaborationModule],
})
export class AppModule {}
