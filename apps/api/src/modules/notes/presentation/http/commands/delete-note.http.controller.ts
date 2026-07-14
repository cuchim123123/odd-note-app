import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../common/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../common/presentation/http/decorators/current-user.decorator';
import { DeleteNoteCommand } from '../../../application/commands/delete-note/delete-note.command';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class DeleteNoteHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':noteId')
  async delete(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.commandBus.execute(new DeleteNoteCommand(userId, noteId));
    return { removed: true };
  }
}
