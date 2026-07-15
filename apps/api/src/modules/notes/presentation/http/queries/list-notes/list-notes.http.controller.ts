import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../../shared/presentation/http/decorators/current-user.decorator';
import { ListNotesQuery } from '../../../../application/queries/list-notes/list-notes.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ListNotesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async list(@CurrentUser() userId: string) {
    return this.queryBus.execute(new ListNotesQuery(userId));
  }
}
