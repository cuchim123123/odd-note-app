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
    private readonly prisma: PrismaService, // Temporary until UoW
  ) {}

  async execute(command: SetPasswordCommand): Promise<void> {
    const { userId, noteId, passwordHash } = command;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to protect it');
    }

    await this.protectionPort.setPassword(userId, noteId, passwordHash);

    // Update Note isProtected field

  }
}
