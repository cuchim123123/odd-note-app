import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ResetPasswordDto } from '@modules/auth/presentation/http/commands/reset-password/reset-password.dto';
import { ResetPasswordCommand } from '@modules/auth/application/commands/reset-password/reset-password.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class ResetPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto) {
    await this.commandBus.execute(new ResetPasswordCommand(input.token!, input.password!));
    return { message: 'Password reset successfully' };
  }
}
