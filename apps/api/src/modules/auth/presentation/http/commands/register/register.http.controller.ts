import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterDto } from './register.dto';
import { RegisterCommand } from '../../../../application/commands/register/register.command';
import { AuthErrorFilter } from '../../../../presentation/filters/auth-error.filter';
import { UserProfileMapper } from '../../../../presentation/mappers/user-profile.mapper';
import type { AuthResult } from '../../../../application/shared/auth.types';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class RegisterHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly userProfileMapper: UserProfileMapper,
  ) {}

  @Post('register')
  async register(@Body() input: RegisterDto) {
    console.log('Registering user:', input);
    const { user, tokens } = await this.commandBus.execute<RegisterCommand, AuthResult>(new RegisterCommand(input));
    return { user: this.userProfileMapper.toProfile(user), tokens };
  }
}
