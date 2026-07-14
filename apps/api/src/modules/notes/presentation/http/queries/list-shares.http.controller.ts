import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { ListSharesQuery } from '../../../application/queries/list-shares/list-shares.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ListSharesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':noteId/shares')
  async listShares(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.queryBus.execute(new ListSharesQuery(userId, noteId));
  }
}
