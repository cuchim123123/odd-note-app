import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { GetNoteHistoryQuery } from '../../../queries/get-note-history/get-note-history.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class GetNoteHistoryHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':noteId/history')
  async getHistory(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.queryBus.execute(new GetNoteHistoryQuery(userId, noteId));
  }
}
