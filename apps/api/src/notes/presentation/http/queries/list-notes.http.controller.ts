import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ListNotesQuery } from '../../../queries/list-notes/list-notes.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ListNotesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async list(@CurrentUser() userId: string) {
    return this.queryBus.execute(new ListNotesQuery(userId));
  }
}
