import { Controller, Get, Headers, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { GetNoteByIdQuery } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class GetNoteByIdHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':noteId')
  async getById(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Headers('x-note-unlock-token') unlockToken?: string,
  ) {
    return this.queryBus.execute(new GetNoteByIdQuery(userId, noteId, unlockToken));
  }
}
