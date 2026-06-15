import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SaveDraftCommand } from './save-draft.command';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const noteDraftSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string(),
});

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class SaveDraftHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':noteId/draft')
  async saveDraft(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(noteDraftSchema)) body: { title: string; content: string },
  ) {
    await this.commandBus.execute(new SaveDraftCommand(userId, noteId, body.title, body.content));
    return { success: true };
  }
}
