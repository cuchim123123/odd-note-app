import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RefreshTokenDto } from './refresh-token.dto';
import { LogoutCommand } from '../../../application/commands/logout/logout.command';
import { AuthErrorFilter } from '../../../presentation/filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class LogoutHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('logout')
  async logout(@Body() input: RefreshTokenDto) {
    await this.commandBus.execute(new LogoutCommand(input.refreshToken!));
    return { success: true };
  }
}
