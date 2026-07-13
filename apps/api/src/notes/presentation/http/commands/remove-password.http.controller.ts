import { Body, Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RemovePasswordCommand } from '../../../application/commands/remove-password/remove-password.command';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const notePasswordSchema = z.object({
  password: z.string().trim().min(1, 'Password is required'),
});

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class RemovePasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Delete(':noteId/password')
  async removePassword(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(notePasswordSchema)) body: { password: string },
  ) {
    // No bcrypt here — controller only validates input shape and dispatches
    return (await this.commandBus.execute(
      new RemovePasswordCommand(userId, noteId, body.password),
    )) as { removed: true };
  }
}
