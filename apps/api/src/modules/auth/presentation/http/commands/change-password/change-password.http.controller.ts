import { Body, Controller, Patch, UseFilters, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ChangePasswordDto } from './change-password.dto';
import { ChangePasswordCommand } from '../../../../application/commands/change-password/change-password.command';
import { AuthErrorFilter } from '../../../../presentation/filters/auth-error.filter';
import { AccessTokenGuard } from '../../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../../shared/presentation/http/decorators/current-user.decorator';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class ChangePasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @UseGuards(AccessTokenGuard)
  @Patch('change-password')
  async changePassword(@CurrentUser() userId: string, @Body() input: ChangePasswordDto) {
    await this.commandBus.execute(new ChangePasswordCommand(userId, input));
    return { success: true, message: 'Password changed successfully' };
  }
}
