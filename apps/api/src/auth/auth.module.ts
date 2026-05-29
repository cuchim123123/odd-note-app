import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { SessionTokenService } from './session-token.service';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { AuthUserMapper } from './auth-user.mapper';
import { EmailVerificationService } from './email-verification.service';
import { VerificationTokenService } from './verification-token.service';
import { PasswordResetTokenService } from './password-reset-token.service';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { TokenCleanupService } from './token-cleanup.service';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { TOKEN_REPOSITORY } from './domain/ports/token.repository.port';
import { PrismaTokenRepository } from './infrastructure/repositories/prisma-token.repository';

// Use cases
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { RefreshUseCase } from './application/use-cases/refresh.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';

@Module({
  imports: [ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    SessionTokenService,
    VerificationTokenService,
    PasswordResetTokenService,
    MailerService,
    AuthUrlService,
    AuthUserMapper,
    EmailVerificationService,
    TokenCleanupService,
    AccessTokenGuard,
    RegisterUseCase,
    LoginUseCase,
    ChangePasswordUseCase,
    RefreshUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    GetCurrentUserUseCase,
    UpdateProfileUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: TOKEN_REPOSITORY, useClass: PrismaTokenRepository },
  ],
  exports: [USER_REPOSITORY, TOKEN_REPOSITORY, RegisterUseCase, LoginUseCase, ChangePasswordUseCase, RefreshUseCase, ForgotPasswordUseCase, ResetPasswordUseCase, GetCurrentUserUseCase, UpdateProfileUseCase],
})
export class AuthModule {}
