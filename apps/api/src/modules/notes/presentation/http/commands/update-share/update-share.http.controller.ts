import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { UpdateShareCommand } from '@modules/notes/application/commands/update-share/update-share.command';
import { ZodValidationPipe } from '@shared/presentation/http/pipes/zod-validation.pipe';
import { updateNoteShareSchema } from '@odd-note-app/validation';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class UpdateShareHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':noteId/shares/:shareId')
  async updateShare(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Param('shareId') shareId: string,
    @Body(new ZodValidationPipe(updateNoteShareSchema)) body: { permission: 'READ' | 'EDIT' },
  ) {
    const result = (await this.commandBus.execute(
      new UpdateShareCommand(userId, noteId, shareId, body.permission)
    )) as { id: string };

    return result;
  }
}
