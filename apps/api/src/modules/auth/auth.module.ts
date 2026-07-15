import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import { JwtTokenProvider } from '@modules/auth/infrastructure/security/jwt-token-provider';
import { AuthConfigModule, JwtConfigModule } from '@config';
import { MAIL_SENDER } from '@modules/auth/application/ports/mail-sender.port';
import { NodemailerMailSender } from '@modules/auth/infrastructure/messaging/nodemailer-mail-sender';
import { UserProfileMapper } from '@modules/auth/presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { TokenCleanupCron } from '@modules/auth/infrastructure/scheduling/token-cleanup.cron';
import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import { PrismaUserRepository } from '@modules/auth/infrastructure/persistence/prisma-user.repository';
import { TOKEN_REPOSITORY } from '@modules/auth/application/ports/token.repository.port';
import { PrismaTokenRepository } from '@modules/auth/infrastructure/persistence/prisma-token.repository';
import { UNIT_OF_WORK } from '@modules/auth/application/ports/unit-of-work.port';
import { PrismaUnitOfWork } from '@modules/auth/infrastructure/persistence/prisma-unit-of-work';
import { PASSWORD_HASHER } from '@modules/auth/application/ports/password-hasher.port';
import { BcryptPasswordHasher } from '@modules/auth/infrastructure/security/bcrypt-password-hasher';
import { INTEGRATION_EVENT_MAPPER } from '@modules/auth/application/ports/integration-event-mapper.port';
import { DefaultIntegrationEventMapper } from '@modules/auth/application/mappers/integration-event.mapper';
import { INTERNAL_COMMAND_HANDLERS } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { AuthInternalCommandHandler } from '@modules/auth/infrastructure/messaging/auth-internal-command.handler';
import { MailerService } from '@shared/infrastructure/messaging/mailer/mailer.service';
import { AuthUrlService } from '@modules/auth/infrastructure/auth-url.service';

// ─── Application: Command Handlers ──────────────────────────────────────────
import { RegisterHandler } from '@modules/auth/application/commands/register/register.handler';
import { LoginHandler } from '@modules/auth/application/commands/login/login.handler';
import { ChangePasswordHandler } from '@modules/auth/application/commands/change-password/change-password.handler';
import { RefreshTokensHandler } from '@modules/auth/application/commands/refresh-tokens/refresh-tokens.handler';
import { ForgotPasswordHandler } from '@modules/auth/application/commands/forgot-password/forgot-password.handler';
import { ResetPasswordHandler } from '@modules/auth/application/commands/reset-password/reset-password.handler';
import { UpdateProfileHandler } from '@modules/auth/application/commands/update-profile/update-profile.handler';
import { LogoutHandler } from '@modules/auth/application/commands/logout/logout.handler';
import { VerifyEmailHandler } from '@modules/auth/application/commands/verify-email/verify-email.handler';
import { ResendVerificationHandler } from '@modules/auth/application/commands/resend-verification/resend-verification.handler';
import { GenerateTestResetTokenHandler } from '@modules/auth/application/commands/generate-test-reset-token/generate-test-reset-token.handler';

// ─── Application: Query Handlers ─────────────────────────────────────────────
import { GetCurrentUserHandler } from '@modules/auth/application/queries/get-current-user/get-current-user.handler';

// ─── Presentation (HTTP Controllers) ─────────────────────────────────────────
import { RegisterHttpController } from '@modules/auth/presentation/http/commands/register/register.http.controller';
import { LoginHttpController } from '@modules/auth/presentation/http/commands/login/login.http.controller';
import { VerifyEmailHttpController } from '@modules/auth/presentation/http/commands/verify-email/verify-email.http.controller';
import { ResendVerificationHttpController } from '@modules/auth/presentation/http/commands/resend-verification/resend-verification.http.controller';
import { UpdateProfileHttpController } from '@modules/auth/presentation/http/commands/update-profile/update-profile.http.controller';
import { ChangePasswordHttpController } from '@modules/auth/presentation/http/commands/change-password/change-password.http.controller';
import { RefreshTokensHttpController } from '@modules/auth/presentation/http/commands/refresh-tokens/refresh-tokens.http.controller';
import { LogoutHttpController } from '@modules/auth/presentation/http/commands/logout/logout.http.controller';
import { ForgotPasswordHttpController } from '@modules/auth/presentation/http/commands/forgot-password/forgot-password.http.controller';
import { ResetPasswordHttpController } from '@modules/auth/presentation/http/commands/reset-password/reset-password.http.controller';
import { GenerateTestResetTokenHttpController } from '@modules/auth/presentation/http/commands/generate-test-reset-token/generate-test-reset-token.http.controller';
import { GetCurrentUserHttpController } from '@modules/auth/presentation/http/queries/get-current-user/get-current-user.http.controller';

@Global()
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
    MailerService,
    AuthUrlService,
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
    INTERNAL_COMMAND_HANDLERS,
  ],
})
export class AuthModule {}
