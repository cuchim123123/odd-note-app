import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../../shared/presentation/http/decorators/current-user.decorator';
import { CreateNoteCommand } from '../../../../application/commands/create-note/create-note.command';
import { ZodValidationPipe } from '../../../../../../shared/presentation/http/pipes/zod-validation.pipe';
import { createNoteSchema, type CreateNoteInput } from '@odd-note-app/validation';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class CreateNoteHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createNoteSchema)) body: CreateNoteInput,
  ) {
    const result = (await this.commandBus.execute(
      new CreateNoteCommand(userId, body.title!, body.content, body.labels)
    )) as { id: string };

    return { id: result.id };
  }
}
