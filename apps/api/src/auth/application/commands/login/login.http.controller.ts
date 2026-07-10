import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoginDto } from './login.dto';
import { LoginCommand } from './login.command';
import { AuthErrorFilter } from '../../../presentation/filters/auth-error.filter';
import { UserProfileMapper } from '../../../presentation/mappers/user-profile.mapper';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../../config/env.validation';
import type { AuthResult } from '../../shared/auth.types';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class LoginHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly userProfileMapper: UserProfileMapper,
    private readonly config: ConfigService<EnvConfig, true>,
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
    const allow = this.config.get('ALLOW_TEST_ENDPOINTS') || this.config.get('NODE_ENV') === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const { user, tokens } = await this.commandBus.execute<LoginCommand, AuthResult>(new LoginCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }
}
