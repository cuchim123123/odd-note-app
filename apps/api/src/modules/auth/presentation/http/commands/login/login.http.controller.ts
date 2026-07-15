import { Body, Controller, Post, UseFilters, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoginDto } from '@modules/auth/presentation/http/commands/login/login.dto';
import { LoginCommand } from '@modules/auth/application/commands/login/login.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';
import { UserProfileMapper } from '@modules/auth/presentation/mappers/user-profile.mapper';
import type { EnvConfig } from '@config/env.validation';
import type { AuthResult } from '@modules/auth/application/shared/auth.types';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class LoginHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly userProfileMapper: UserProfileMapper,
    @Inject('ENV_CONFIG') private readonly env: EnvConfig,
  ) {}

  @Post('login')
  async login(@Body() input: LoginDto) {
    const { user, tokens } = await this.commandBus.execute<LoginCommand, AuthResult>(new LoginCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }

  // Development-only: test login endpoint that returns auth tokens for test automation.
  // Bypasses email verification requirement for test convenience.
  @Post('test/login')
  async testLogin(@Body() input: LoginDto) {
    const allow = this.env.ALLOW_TEST_ENDPOINTS || this.env.NODE_ENV === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const { user, tokens } = await this.commandBus.execute<LoginCommand, AuthResult>(new LoginCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }
}
