import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { GenerateTestResetTokenCommand } from './generate-test-reset-token.command';
import { AuthErrorFilter } from '../../../presentation/filters/auth-error.filter';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../../config/env.validation';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class GenerateTestResetTokenHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // Development-only: generate a reset token for an email and return the raw token.
  // This endpoint is intentionally gated and should NOT be enabled in production.
  @Post('test/generate-reset-token')
  async generateResetTokenForTest(@Body() body: { email: string }) {
    const allow = this.config.get('ALLOW_TEST_ENDPOINTS') || this.config.get('NODE_ENV') === 'test';
    if (!allow) {
      return { message: 'Not available' };
    }

    const result = await this.commandBus.execute(new GenerateTestResetTokenCommand(body.email)) as { token?: string };
    
    if (!result.token) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    return { token: result.token };
  }
}
