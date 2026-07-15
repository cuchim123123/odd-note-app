import { Controller, Get, Param, UseFilters } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { VerifyEmailCommand } from '@modules/auth/application/commands/verify-email/verify-email.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';
import { UserProfileMapper } from '@modules/auth/presentation/mappers/user-profile.mapper';
import type { User } from '@modules/auth/domain/entities/user.entity';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class VerifyEmailHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly userProfileMapper: UserProfileMapper,
  ) {}

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    const { user } = await this.commandBus.execute<VerifyEmailCommand, { user: User }>(new VerifyEmailCommand(token.trim()));
    return { user: this.userProfileMapper.toProfile(user) };
  }
}
