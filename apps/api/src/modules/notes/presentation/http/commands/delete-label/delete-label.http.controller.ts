import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { DeleteLabelCommand } from '@modules/notes/application/commands/delete-label/delete-label.command';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class DeleteLabelHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete('labels/:labelName')
  async deleteLabel(
    @CurrentUser() userId: string,
    @Param('labelName') labelName: string,
  ) {
    return this.commandBus.execute(new DeleteLabelCommand(userId, labelName));
  }
}
