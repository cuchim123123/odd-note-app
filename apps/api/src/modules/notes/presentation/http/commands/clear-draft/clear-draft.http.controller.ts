import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { ClearDraftCommand } from '@modules/notes/application/commands/clear-draft/clear-draft.command';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ClearDraftHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':noteId/draft')
  async clearDraft(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.commandBus.execute(new ClearDraftCommand(userId, noteId));
    return { success: true };
  }
}
