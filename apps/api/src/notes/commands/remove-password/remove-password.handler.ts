import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RemovePasswordCommand } from './remove-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { NoteNotFoundError, IncorrectPasswordError } from '../../domain/errors/note.errors';

@CommandHandler(RemovePasswordCommand)
export class RemovePasswordHandler implements ICommandHandler<RemovePasswordCommand> {
  constructor(
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: RemovePasswordCommand): Promise<{ removed: true }> {
    const { userId, noteId, password } = command;

    // Read-only ownership check — acceptable CQRS read-model bypass in command handler
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new NoteNotFoundError(noteId);

    // Verify password via port before removing (adapter does the bcrypt.compare)
    const isValid = await this.protectionPort.verifyPassword(userId, noteId, password);
    if (!isValid) throw new IncorrectPasswordError();

    await this.protectionPort.removePassword(userId, noteId);

    return { removed: true };
  }
}
