import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './presentation/auth.controller';
import { TOKEN_PROVIDER } from './application/ports/token-provider.port';
import { JwtTokenProvider } from './infrastructure/adapters/jwt-token-provider.adapter';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { AuthUserMapper } from './infrastructure/mappers/auth-user.mapper';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { TokenCleanupService } from './application/services/token-cleanup.service';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { TOKEN_REPOSITORY } from './application/ports/token.repository.port';
import { PrismaTokenRepository } from './infrastructure/repositories/prisma-token.repository';
import { UNIT_OF_WORK } from './application/ports/unit-of-work.port';
import { PrismaUnitOfWork } from './infrastructure/repositories/prisma-unit-of-work';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { BcryptPasswordHasher } from './infrastructure/adapters/bcrypt-password-hasher.adapter';

// Use cases
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { RefreshUseCase } from './application/use-cases/refresh.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendVerificationUseCase } from './application/use-cases/resend-verification.use-case';

@Module({
  imports: [ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    MailerService,
    AuthUrlService,
    AuthUserMapper,
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
    LogoutUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: TOKEN_REPOSITORY, useClass: PrismaTokenRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_PROVIDER, useClass: JwtTokenProvider },
  ],
  exports: [
    USER_REPOSITORY,
    TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    RegisterUseCase,
    LoginUseCase,
    ChangePasswordUseCase,
    RefreshUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    GetCurrentUserUseCase,
    UpdateProfileUseCase,
    LogoutUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
  ],
})
export class AuthModule {}
