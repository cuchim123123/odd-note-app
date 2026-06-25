import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetPasswordCommand } from './set-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { NoteNotFoundError } from '../../domain/errors/note.errors';

@CommandHandler(SetPasswordCommand)
export class SetPasswordHandler implements ICommandHandler<SetPasswordCommand> {
  constructor(
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: SetPasswordCommand): Promise<{ isProtected: true }> {
    const { userId, noteId, password } = command;

    // Read-only ownership check — acceptable CQRS read-model bypass in command handler
    const note = await this.prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new NoteNotFoundError(noteId);

    // Hashing is the adapter's responsibility — we pass the raw password
    await this.protectionPort.setPassword(userId, noteId, password);

    return { isProtected: true };
  }
}
