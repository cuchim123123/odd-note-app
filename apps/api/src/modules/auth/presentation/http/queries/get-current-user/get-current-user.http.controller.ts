import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetCurrentUserQuery } from '../../../../application/queries/get-current-user/get-current-user.query';
import { AuthErrorFilter } from '../../../../presentation/filters/auth-error.filter';
import { UserProfileMapper } from '../../../../presentation/mappers/user-profile.mapper';
import { AccessTokenGuard } from '../../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../../shared/presentation/http/decorators/current-user.decorator';
import type { User } from '../../../../domain/entities/user.entity';

@UseFilters(AuthErrorFilter)
@Controller('auth')
export class GetCurrentUserHttpController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly userProfileMapper: UserProfileMapper,
  ) {}

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() userId: string) {
    const user = await this.queryBus.execute<GetCurrentUserQuery, User>(new GetCurrentUserQuery(userId));
    return this.userProfileMapper.toProfile(user);
  }
}
