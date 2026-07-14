import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { RevokeShareCommand } from '../../../application/commands/revoke-share/revoke-share.command';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class RevokeShareHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':noteId/shares/:shareId')
  async deleteShare(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Param('shareId') shareId: string,
  ) {
    await this.commandBus.execute(new RevokeShareCommand(userId, noteId, shareId));
    return { removed: true };
  }
}
