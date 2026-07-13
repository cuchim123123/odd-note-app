import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { ShareNoteCommand } from '../../../commands/share-note/share-note.command';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { createNoteShareSchema } from '@odd-note-app/validation';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class ShareNoteHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':noteId/shares')
  async createShare(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(createNoteShareSchema)) body: { recipientEmail: string; permission: 'READ' | 'EDIT' },
  ) {
    const result = (await this.commandBus.execute(
      new ShareNoteCommand(userId, noteId, body.recipientEmail, body.permission)
    )) as { id: string };

    return result;
  }
}
