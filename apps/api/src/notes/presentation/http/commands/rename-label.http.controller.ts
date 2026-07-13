import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RenameLabelCommand } from '../../../commands/rename-label/rename-label.command';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
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
