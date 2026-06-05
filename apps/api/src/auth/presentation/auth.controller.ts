import { Body, Controller, Get, Param, Patch, Post, UseGuards, Inject, UseFilters } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { USER_REPOSITORY } from '../application/ports/user.repository.port';
import type { UserRepository } from '../application/ports/user.repository.port';
import { TOKEN_PROVIDER } from '../application/ports/token-provider.port';
import type { TokenProvider } from '../application/ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../application/ports/token.repository.port';
import type { TokenRepository } from '../application/ports/token.repository.port';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto, ResendVerificationDto, UpdateProfileDto } from './dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Commands
import { RegisterCommand } from '../application/commands/register/register.command';
import { LoginCommand } from '../application/commands/login/login.command';
import { ChangePasswordCommand } from '../application/commands/change-password/change-password.command';
import { RefreshTokensCommand } from '../application/commands/refresh-tokens/refresh-tokens.command';
import { ForgotPasswordCommand } from '../application/commands/forgot-password/forgot-password.command';
import { ResetPasswordCommand } from '../application/commands/reset-password/reset-password.command';
import { UpdateProfileCommand } from '../application/commands/update-profile/update-profile.command';
import { LogoutCommand } from '../application/commands/logout/logout.command';
import { VerifyEmailCommand } from '../application/commands/verify-email/verify-email.command';
import { ResendVerificationCommand } from '../application/commands/resend-verification/resend-verification.command';

// Queries
import { GetCurrentUserQuery } from '../application/queries/get-current-user/get-current-user.query';

// Presentation
import { UserProfileMapper } from './mappers/user-profile.mapper';
import { AuthErrorFilter } from './filters/auth-error.filter';
import type { AuthResult } from '../application/shared/auth.types';
import type { User } from '../domain/entities/user.entity';
import type { AuthTokens } from '../application/shared/auth.types';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly userProfileMapper: UserProfileMapper,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    const { user, tokens } = await this.commandBus.execute<RegisterCommand, AuthResult>(new RegisterCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }

  @Post('login')
  async login(@Body() input: LoginDto) {
    const { user, tokens } = await this.commandBus.execute<LoginCommand, AuthResult>(new LoginCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    const { user } = await this.commandBus.execute<VerifyEmailCommand, { user: User }>(new VerifyEmailCommand(token.trim()));
    return { user: this.userProfileMapper.toProfile(user) };
  }

  @Post('resend-verification')
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.commandBus.execute(new ResendVerificationCommand(input.email!));
    return { success: true, message: 'If the email is registered and unverified, a new verification link has been sent.' };
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() userId: string) {
    const user = await this.queryBus.execute<GetCurrentUserQuery, User>(new GetCurrentUserQuery(userId));
    return this.userProfileMapper.toProfile(user);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() userId: string, @Body() input: UpdateProfileDto) {
    const user = await this.commandBus.execute<UpdateProfileCommand, User>(new UpdateProfileCommand(userId, input));
    return this.userProfileMapper.toProfile(user);
  }

  @UseGuards(AccessTokenGuard)
  @Patch('change-password')
  async changePassword(@CurrentUser() userId: string, @Body() input: ChangePasswordDto) {
    await this.commandBus.execute(new ChangePasswordCommand(userId, input));
    return { success: true, message: 'Password changed successfully' };
  }

  @Post('refresh')
  async refresh(@Body() input: RefreshTokenDto) {
    return await this.commandBus.execute<RefreshTokensCommand, AuthTokens>(new RefreshTokensCommand(input.refreshToken!));
  }

  @Post('logout')
  async logout(@Body() input: RefreshTokenDto) {
    await this.commandBus.execute(new LogoutCommand(input.refreshToken!));
    return { success: true };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.commandBus.execute(new ForgotPasswordCommand(input.email!));
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.commandBus.execute(new ResetPasswordCommand(input.token!, input.password!));
    return { message: 'Password reset successfully' };
  }

  // Development-only: generate a reset token for an email and return the raw token.
  // This endpoint is intentionally gated and should NOT be enabled in production.
  @Post('test/generate-reset-token')
  async generateResetTokenForTest(@Body() body: { email: string }) {
    const allow = process.env.ALLOW_TEST_ENDPOINTS === '1' || process.env.NODE_ENV === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const user = await this.userRepo.findByEmail(body.email);
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();
    await this.tokenRepo.createResetToken({
      tokenHash,
      expiresAt,
      userId: user.id,
    });
    return { token: rawToken };
  }

  // Development-only: test login endpoint that returns auth tokens for test automation.
  // Bypasses email verification requirement for test convenience.
  @Post('test/login')
  async testLogin(@Body() input: LoginDto) {
    const allow = process.env.ALLOW_TEST_ENDPOINTS === '1' || process.env.NODE_ENV === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const { user, tokens } = await this.commandBus.execute<LoginCommand, AuthResult>(new LoginCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }
}
