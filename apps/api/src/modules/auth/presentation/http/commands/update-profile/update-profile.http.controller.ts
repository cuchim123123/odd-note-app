import { Body, Controller, Patch, UseFilters, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateProfileDto } from '@modules/auth/presentation/http/commands/update-profile/update-profile.dto';
import { UpdateProfileCommand } from '@modules/auth/application/commands/update-profile/update-profile.command';
import { AuthErrorFilter } from '@modules/auth/presentation/filters/auth-error.filter';
import { UserProfileMapper } from '@modules/auth/presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import type { User } from '@modules/auth/domain/entities/user.entity';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class UpdateProfileHttpController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly userProfileMapper: UserProfileMapper,
  ) {}

  @UseGuards(AccessTokenGuard)
  @Patch('profile')
  async updateProfile(@CurrentUser() userId: string, @Body() input: UpdateProfileDto) {
    const user = await this.commandBus.execute<UpdateProfileCommand, User>(new UpdateProfileCommand(userId, input));
    return this.userProfileMapper.toProfile(user);
  }
}
