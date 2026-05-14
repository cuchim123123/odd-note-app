import { Module } from '@nestjs/common';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MailerService } from '../common/mailer/mailer.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule],
  controllers: [NotesController],
  providers: [NotesService, MailerService],
})
export class NotesModule {}
