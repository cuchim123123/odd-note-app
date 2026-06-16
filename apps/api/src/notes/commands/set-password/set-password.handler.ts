import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { SetPasswordCommand } from './set-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(SetPasswordCommand)
export class SetPasswordHandler implements ICommandHandler<SetPasswordCommand> {
  constructor(
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: SetPasswordCommand): Promise<{ isProtected: true }> {
    const { userId, noteId, password } = command;

    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) {
      throw new NotFoundException('Note not found or you are not the owner');
    }

    // Hashing is the adapter's responsibility — we pass the raw password
    await this.protectionPort.setPassword(userId, noteId, password);

    return { isProtected: true };
  }
}
