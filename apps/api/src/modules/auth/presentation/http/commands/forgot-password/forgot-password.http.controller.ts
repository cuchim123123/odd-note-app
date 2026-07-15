import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ForgotPasswordDto } from '@modules/auth/presentation/http/commands/forgot-password/forgot-password.dto';
import { ForgotPasswordCommand } from '@modules/auth/application/commands/forgot-password/forgot-password.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class ForgotPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    await this.commandBus.execute(new ForgotPasswordCommand(input.email!));
    return { message: 'If the email exists, a reset link has been sent' };
  }
}
