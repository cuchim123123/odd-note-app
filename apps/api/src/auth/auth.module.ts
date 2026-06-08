import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './presentation/auth.controller';
import { TOKEN_PROVIDER } from './application/ports/token-provider.port';
import { JwtTokenProvider } from './infrastructure/security/jwt-token-provider';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MAIL_SENDER } from './application/ports/mail-sender.port';
import { NodemailerMailSender } from './infrastructure/messaging/nodemailer-mail-sender';
import { UserProfileMapper } from './presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { TokenCleanupCron } from './infrastructure/scheduling/token-cleanup.cron';
import { OutboxProcessor } from './infrastructure/scheduling/outbox.processor';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { TOKEN_REPOSITORY } from './application/ports/token.repository.port';
import { PrismaTokenRepository } from './infrastructure/persistence/prisma-token.repository';
import { UNIT_OF_WORK } from './application/ports/unit-of-work.port';
import { PrismaUnitOfWork } from './infrastructure/persistence/prisma-unit-of-work';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher';
import { INTEGRATION_EVENT_MAPPER } from './application/ports/integration-event-mapper.port';
import { DefaultIntegrationEventMapper } from './application/mappers/integration-event.mapper';

// Commands
import { RegisterHandler } from './application/commands/register/register.handler';
import { LoginHandler } from './application/commands/login/login.handler';
import { ChangePasswordHandler } from './application/commands/change-password/change-password.handler';
import { RefreshTokensHandler } from './application/commands/refresh-tokens/refresh-tokens.handler';
import { ForgotPasswordHandler } from './application/commands/forgot-password/forgot-password.handler';
import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler';
import { UpdateProfileHandler } from './application/commands/update-profile/update-profile.handler';
import { LogoutHandler } from './application/commands/logout/logout.handler';
import { VerifyEmailHandler } from './application/commands/verify-email/verify-email.handler';
import { ResendVerificationHandler } from './application/commands/resend-verification/resend-verification.handler';
import { GenerateTestResetTokenHandler } from './application/commands/generate-test-reset-token/generate-test-reset-token.handler';

// Queries
import { GetCurrentUserHandler } from './application/queries/get-current-user/get-current-user.handler';

@Module({
  imports: [CqrsModule, ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    UserProfileMapper,
    TokenCleanupCron,
    AccessTokenGuard,
    // Commands
    RegisterHandler,
    LoginHandler,
    ChangePasswordHandler,
    RefreshTokensHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    UpdateProfileHandler,
    LogoutHandler,
    VerifyEmailHandler,
    ResendVerificationHandler,
    GenerateTestResetTokenHandler,
    // Queries
    GetCurrentUserHandler,
    // Port bindings
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: TOKEN_REPOSITORY, useClass: PrismaTokenRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_PROVIDER, useClass: JwtTokenProvider },
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
    { provide: INTEGRATION_EVENT_MAPPER, useClass: DefaultIntegrationEventMapper },
    OutboxProcessor,
  ],
  exports: [
    USER_REPOSITORY,
    TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PASSWORD_HASHER,
    // Commands
    RegisterHandler,
    LoginHandler,
    ChangePasswordHandler,
    RefreshTokensHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    UpdateProfileHandler,
    LogoutHandler,
    VerifyEmailHandler,
    ResendVerificationHandler,
    GenerateTestResetTokenHandler,
    // Queries
    GetCurrentUserHandler,
  ],
})
export class AuthModule {}

