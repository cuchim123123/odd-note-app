import { Body, Controller, Post, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RegisterDto } from '@modules/auth/presentation/http/commands/register/register.dto';
import { RegisterCommand } from '@modules/auth/application/commands/register/register.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';
import { UserProfileMapper } from '@modules/auth/presentation/mappers/user-profile.mapper';
import type { AuthResult } from '@modules/auth/application/shared/auth.types';

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
