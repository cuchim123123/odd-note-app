import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtConfigModule } from '../config';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule, JwtConfigModule],
  providers: [NotificationsService, AccessTokenGuard],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
