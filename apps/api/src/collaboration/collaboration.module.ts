import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { JwtConfigModule, JwtConfigService } from '../config';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotesModule } from '../notes/notes.module';
import { CollaborationGateway } from './collaboration.gateway';

@Module({
  imports: [
    ConfigModule,
    JwtConfigModule,
    RedisModule,
    PrismaModule,
    NotesModule,
    JwtModule.registerAsync({
      imports: [JwtConfigModule],
      inject: [JwtConfigService],
      useFactory: (jwtConfig: JwtConfigService) => ({
        secret: jwtConfig.getAccessTokenSecret(),
      }),
    }),
  ],
  providers: [CollaborationGateway],
  exports: [CollaborationGateway],
})
export class CollaborationModule {}
