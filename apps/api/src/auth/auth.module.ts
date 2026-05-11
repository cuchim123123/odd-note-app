import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AppConfigModule, AuthConfigModule, JwtConfigModule } from '../config';
import { MailerService } from '../common/mailer/mailer.service';

@Module({
  imports: [ConfigModule, PrismaModule, AppConfigModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, MailerService],
})
export class AuthModule {}
