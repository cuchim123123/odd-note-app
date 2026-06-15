import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { RemovePasswordCommand } from './remove-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(RemovePasswordCommand)
export class RemovePasswordHandler implements ICommandHandler<RemovePasswordCommand> {
  constructor(
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
    private readonly prisma: PrismaService, // Temporary until UoW
  ) {}

  async execute(command: RemovePasswordCommand): Promise<void> {
    const { userId, noteId, passwordHash } = command;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its protection');
    }

    const isValid = await this.protectionPort.verifyPassword(userId, noteId, passwordHash);
    if (!isValid) {
      throw new Error('Invalid password'); // will throw UnauthorizedException when caught or handled
    }

    await this.protectionPort.removePassword(userId, noteId);


  }
}
