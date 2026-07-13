import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RestoreRevisionCommand } from '../../../commands/restore-revision/restore-revision.command';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class RestoreRevisionHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * POST /api/notes/:noteId/history/:revisionId/restore
   * Restores the note to the state captured at the given revision.
   */
  @Post(':noteId/history/:revisionId/restore')
  async restore(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.commandBus.execute(new RestoreRevisionCommand(userId, noteId, revisionId));
  }
}
