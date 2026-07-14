import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../shared/presentation/http/decorators/current-user.decorator';
import { SetPasswordCommand } from '../../../application/commands/set-password/set-password.command';
import { ZodValidationPipe } from '../../../../../shared/presentation/http/pipes/zod-validation.pipe';
import { z } from 'zod';

const notePasswordSchema = z.object({
  password: z.string().trim().min(1, 'Password is required'),
});

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class SetPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':noteId/set-password')
  async setPassword(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(notePasswordSchema)) body: { password: string },
  ) {
    // No bcrypt here — controller only validates input shape and dispatches
    return (await this.commandBus.execute(
      new SetPasswordCommand(userId, noteId, body.password),
    )) as { isProtected: true };
  }
}
