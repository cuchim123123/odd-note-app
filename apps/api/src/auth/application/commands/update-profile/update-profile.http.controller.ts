import { Body, Controller, Patch, UseFilters, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateProfileDto } from './update-profile.dto';
import { UpdateProfileCommand } from './update-profile.command';
import { AuthErrorFilter } from '../../../presentation/filters/auth-error.filter';
import { UserProfileMapper } from '../../../presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { User } from '../../../domain/entities/user.entity';

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
