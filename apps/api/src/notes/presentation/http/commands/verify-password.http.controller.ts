import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { VerifyPasswordCommand } from '../../../application/commands/verify-password/verify-password.command';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const schema = z.object({ password: z.string().trim().min(1, 'Password is required') });

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class VerifyPasswordHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':noteId/verify-password')
  async verifyPassword(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(schema)) body: { password: string },
  ) {
    return this.commandBus.execute(new VerifyPasswordCommand(userId, noteId, body.password));
  }
}
