import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '../../config/config.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { TOKEN_PROVIDER } from './application/ports/token-provider.port';
import { JwtTokenProvider } from './infrastructure/security/jwt-token-provider';
import { AuthConfigModule, JwtConfigModule } from '../../config';
import { MAIL_SENDER } from './application/ports/mail-sender.port';
import { NodemailerMailSender } from './infrastructure/messaging/nodemailer-mail-sender';
import { UserProfileMapper } from './presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '../../shared/presentation/http/guards/access-token.guard';
import { TokenCleanupCron } from './infrastructure/scheduling/token-cleanup.cron';
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
import { INTERNAL_COMMAND_HANDLERS } from '../../shared/infrastructure/outbox/internal-command-handler.port';
import { AuthInternalCommandHandler } from './infrastructure/messaging/auth-internal-command.handler';

// ─── Application: Command Handlers ──────────────────────────────────────────
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

// ─── Application: Query Handlers ─────────────────────────────────────────────
import { GetCurrentUserHandler } from './application/queries/get-current-user/get-current-user.handler';

// ─── Presentation (HTTP Controllers) ─────────────────────────────────────────
import { RegisterHttpController } from './presentation/http/commands/register.http.controller';
import { LoginHttpController } from './presentation/http/commands/login.http.controller';
import { VerifyEmailHttpController } from './presentation/http/commands/verify-email.http.controller';
import { ResendVerificationHttpController } from './presentation/http/commands/resend-verification.http.controller';
import { UpdateProfileHttpController } from './presentation/http/commands/update-profile.http.controller';
import { ChangePasswordHttpController } from './presentation/http/commands/change-password.http.controller';
import { RefreshTokensHttpController } from './presentation/http/commands/refresh-tokens.http.controller';
import { LogoutHttpController } from './presentation/http/commands/logout.http.controller';
import { ForgotPasswordHttpController } from './presentation/http/commands/forgot-password.http.controller';
import { ResetPasswordHttpController } from './presentation/http/commands/reset-password.http.controller';
import { GenerateTestResetTokenHttpController } from './presentation/http/commands/generate-test-reset-token.http.controller';
import { GetCurrentUserHttpController } from './presentation/http/queries/get-current-user.http.controller';

@Module({
  imports: [CqrsModule, ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [
    // ── Presentation: Commands ────────────────────────────────────────────
    RegisterHttpController,
    LoginHttpController,
    VerifyEmailHttpController,
    ResendVerificationHttpController,
    UpdateProfileHttpController,
    ChangePasswordHttpController,
    RefreshTokensHttpController,
    LogoutHttpController,
    ForgotPasswordHttpController,
    ResetPasswordHttpController,
    GenerateTestResetTokenHttpController,
    // ── Presentation: Queries ─────────────────────────────────────────────
    GetCurrentUserHttpController,
  ],
  providers: [
    UserProfileMapper,
    TokenCleanupCron,
    AccessTokenGuard,
    // ── Application: Command Handlers ─────────────────────────────────────
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
    // ── Application: Query Handlers ───────────────────────────────────────
    GetCurrentUserHandler,
    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: TOKEN_REPOSITORY, useClass: PrismaTokenRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_PROVIDER, useClass: JwtTokenProvider },
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
    { provide: INTEGRATION_EVENT_MAPPER, useClass: DefaultIntegrationEventMapper },
    // Register auth's internal command handler with the shared OutboxProcessor.
    AuthInternalCommandHandler,
    {
      provide: INTERNAL_COMMAND_HANDLERS,
      useFactory: (h: AuthInternalCommandHandler) => h,
      inject: [AuthInternalCommandHandler],
      multi: true,
    } as never,
  ],
  exports: [
    USER_REPOSITORY,
    TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PASSWORD_HASHER,
  ],
})
export class AuthModule {}
