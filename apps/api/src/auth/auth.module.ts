import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionTokenService } from './session-token.service';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUserMapper } from './auth-user.mapper';
import { EmailVerificationService } from './email-verification.service';
import { VerificationTokenService } from './verification-token.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionTokenService,
    VerificationTokenService,
    MailerService,
    AuthUserMapper,
    EmailVerificationService,
  ],
})
export class AuthModule {}
