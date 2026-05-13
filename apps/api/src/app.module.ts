import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { JwtConfigModule } from './config/jwt-config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [ConfigModule, JwtConfigModule, HealthModule, PrismaModule, AuthModule, UploadsModule],
})
export class AppModule {}
