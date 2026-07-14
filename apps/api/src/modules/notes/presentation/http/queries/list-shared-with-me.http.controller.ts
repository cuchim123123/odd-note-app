import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../common/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../common/presentation/http/decorators/current-user.decorator';
import { ListSharedWithMeQuery } from '../../../application/queries/list-shared-with-me/list-shared-with-me.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ListSharedWithMeHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('shared-with-me')
  async sharedWithMe(@CurrentUser() userId: string) {
    return this.queryBus.execute(new ListSharedWithMeQuery(userId));
  }
}
