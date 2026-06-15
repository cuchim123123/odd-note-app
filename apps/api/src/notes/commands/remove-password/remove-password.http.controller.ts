import { Body, Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RemovePasswordCommand } from './remove-password.command';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';

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
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(body.password, salt);

    await this.commandBus.execute(new RemovePasswordCommand(userId, noteId, passwordHash));
    return { success: true };
  }
}
