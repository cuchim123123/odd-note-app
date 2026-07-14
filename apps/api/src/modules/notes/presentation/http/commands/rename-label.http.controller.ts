import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { RenameLabelCommand } from '../../../application/commands/rename-label/rename-label.command';
import { ZodValidationPipe } from '../../../../../shared/presentation/http/pipes/zod-validation.pipe';
import { z } from 'zod';

const schema = z.object({
  oldName: z.string().trim().min(1),
  newName: z.string().trim().min(1),
});

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class RenameLabelHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('labels/rename')
  async renameLabel(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(schema)) body: { oldName: string; newName: string },
  ) {
    return this.commandBus.execute(new RenameLabelCommand(userId, body.oldName, body.newName));
  }
}
