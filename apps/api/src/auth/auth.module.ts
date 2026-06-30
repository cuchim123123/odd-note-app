import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TOKEN_PROVIDER } from './application/ports/token-provider.port';
import { JwtTokenProvider } from './infrastructure/security/jwt-token-provider';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { MAIL_SENDER } from './application/ports/mail-sender.port';
import { NodemailerMailSender } from './infrastructure/messaging/nodemailer-mail-sender';
import { UserProfileMapper } from './presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
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
import { INTERNAL_COMMAND_HANDLERS } from '../common/infrastructure/outbox/internal-command-handler.port';
import { AuthInternalCommandHandler } from './infrastructure/messaging/auth-internal-command.handler';

// Commands
import { RegisterHandler } from './application/commands/register/register.handler';
import { RegisterHttpController } from './application/commands/register/register.http.controller';

import { LoginHandler } from './application/commands/login/login.handler';
import { LoginHttpController } from './application/commands/login/login.http.controller';

import { ChangePasswordHandler } from './application/commands/change-password/change-password.handler';
import { ChangePasswordHttpController } from './application/commands/change-password/change-password.http.controller';

import { RefreshTokensHandler } from './application/commands/refresh-tokens/refresh-tokens.handler';
import { RefreshTokensHttpController } from './application/commands/refresh-tokens/refresh-tokens.http.controller';

import { ForgotPasswordHandler } from './application/commands/forgot-password/forgot-password.handler';
import { ForgotPasswordHttpController } from './application/commands/forgot-password/forgot-password.http.controller';

import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler';
import { ResetPasswordHttpController } from './application/commands/reset-password/reset-password.http.controller';

import { UpdateProfileHandler } from './application/commands/update-profile/update-profile.handler';
import { UpdateProfileHttpController } from './application/commands/update-profile/update-profile.http.controller';

import { LogoutHandler } from './application/commands/logout/logout.handler';
import { LogoutHttpController } from './application/commands/logout/logout.http.controller';

import { VerifyEmailHandler } from './application/commands/verify-email/verify-email.handler';
import { VerifyEmailHttpController } from './application/commands/verify-email/verify-email.http.controller';

import { ResendVerificationHandler } from './application/commands/resend-verification/resend-verification.handler';
import { ResendVerificationHttpController } from './application/commands/resend-verification/resend-verification.http.controller';

import { GenerateTestResetTokenHandler } from './application/commands/generate-test-reset-token/generate-test-reset-token.handler';
import { GenerateTestResetTokenHttpController } from './application/commands/generate-test-reset-token/generate-test-reset-token.http.controller';

// Queries
import { GetCurrentUserHandler } from './application/queries/get-current-user/get-current-user.handler';
import { GetCurrentUserHttpController } from './application/queries/get-current-user/get-current-user.http.controller';

@Module({
  imports: [CqrsModule, ConfigModule, PrismaModule, AuthConfigModule, JwtConfigModule],
  controllers: [
    RegisterHttpController,
    LoginHttpController,
    VerifyEmailHttpController,
    ResendVerificationHttpController,
    GetCurrentUserHttpController,
    UpdateProfileHttpController,
    ChangePasswordHttpController,
    RefreshTokensHttpController,
    LogoutHttpController,
    ForgotPasswordHttpController,
    ResetPasswordHttpController,
    GenerateTestResetTokenHttpController,
  ],
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
    // Register auth's internal command handler with the shared OutboxProcessor.
    // useFactory + multi is the TS-safe way to register a multi-provider in NestJS.
    AuthInternalCommandHandler,
    {
      provide: INTERNAL_COMMAND_HANDLERS,
      useFactory: (h: AuthInternalCommandHandler) => h,
      inject: [AuthInternalCommandHandler],
      multi: true,
    } as never,
  ],
  exports: [
    // Port tokens exported for modules that may need to resolve user/token data
    // (e.g., a future UserModule). All cross-module communication must use CommandBus/QueryBus.
    USER_REPOSITORY,
    TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PASSWORD_HASHER,
  ],
})
export class AuthModule {}

