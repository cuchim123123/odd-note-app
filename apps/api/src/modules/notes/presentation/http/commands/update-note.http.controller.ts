import { Body, Controller, Headers, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { UpdateNoteCommand } from '../../../application/commands/update-note/update-note.command';
import { ZodValidationPipe } from '../../../../../shared/presentation/http/pipes/zod-validation.pipe';
import { updateNoteSchema, type UpdateNoteInput } from '@odd-note-app/validation';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class UpdateNoteHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':noteId')
  async update(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Headers('x-note-unlock-token') unlockToken: string | undefined,
    @Body(new ZodValidationPipe(updateNoteSchema)) body: UpdateNoteInput,
  ) {
    const result = (await this.commandBus.execute(
      new UpdateNoteCommand(
        userId,
        noteId,
        body.title,
        body.content,
        body.isPinned,
        body.isShared,
        body.labels,
        unlockToken,
      )
    )) as { id: string };

    return { id: result.id };
  }
}
