import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RefreshTokenDto } from './refresh-token.dto';
import { RefreshTokensCommand } from '../../../application/commands/refresh-tokens/refresh-tokens.command';
import { AuthErrorFilter } from '../../../presentation/filters/auth-error.filter';
import type { AuthTokens } from '../../../application/shared/auth.types';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class RefreshTokensHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('refresh')
  async refresh(@Body() input: RefreshTokenDto) {
    return await this.commandBus.execute<RefreshTokensCommand, AuthTokens>(new RefreshTokensCommand(input.refreshToken!));
  }
}
