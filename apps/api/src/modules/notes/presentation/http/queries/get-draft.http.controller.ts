import { Controller, Get, Headers, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../common/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../common/presentation/http/decorators/current-user.decorator';
import { GetDraftQuery } from '../../../application/queries/get-draft/get-draft.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class GetDraftHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':noteId/draft')
  async getDraft(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Headers('x-note-unlock-token') unlockToken?: string,
  ) {
    return this.queryBus.execute(new GetDraftQuery(userId, noteId, unlockToken));
  }
}
