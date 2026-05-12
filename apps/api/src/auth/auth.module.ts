import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionTokenService } from './session-token.service';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { AuthUserMapper } from './auth-user.mapper';
import { EmailVerificationService } from './email-verification.service';
import { VerificationTokenService } from './verification-token.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { PasswordResetService } from './password-reset.service';

import { TokenCleanupService } from './token-cleanup.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionTokenService,
    VerificationTokenService,
    PasswordResetTokenService,
    MailerService,
    AuthUrlService,
    AuthUserMapper,
    EmailVerificationService,
    PasswordResetService,
    TokenCleanupService,
  ],
})
export class AuthModule {}
