import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ResendVerificationDto } from '@modules/auth/presentation/http/commands/resend-verification/resend-verification.dto';
import { ResendVerificationCommand } from '@modules/auth/application/commands/resend-verification/resend-verification.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class ResendVerificationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('resend-verification')
  async resendVerification(@Body() input: ResendVerificationDto) {
    await this.commandBus.execute(new ResendVerificationCommand(input.email!));
    return { success: true, message: 'If the email is registered and unverified, a new verification link has been sent.' };
  }
}
