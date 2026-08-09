import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { UpdateNoteMetadataCommand } from '@modules/notes/application/commands/update-note-metadata/update-note-metadata.command';
import { ZodValidationPipe } from '@shared/presentation/http/pipes/zod-validation.pipe';
import { updateNoteMetadataSchema, type UpdateNoteMetadataInput } from '@odd-note-app/validation';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class UpdateNoteMetadataHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':noteId')
  async update(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(updateNoteMetadataSchema)) body: UpdateNoteMetadataInput,
  ) {
    const result = (await this.commandBus.execute(
      new UpdateNoteMetadataCommand(
        userId,
        noteId,
        body.title,
        body.isPinned,
        body.labels,
      )
    )) as { id: string };

    return { id: result.id };
  }
}
