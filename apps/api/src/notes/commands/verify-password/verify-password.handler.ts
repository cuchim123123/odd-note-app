import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { VerifyPasswordCommand } from './verify-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { PrismaService } from '../../../prisma/prisma.service';

@CommandHandler(VerifyPasswordCommand)
export class VerifyPasswordHandler implements ICommandHandler<VerifyPasswordCommand> {
  constructor(
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: VerifyPasswordCommand): Promise<{ verified: boolean; unlockToken?: string }> {
    const { userId, noteId, password } = command;

    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        OR: [{ userId }, { shares: { some: { recipientId: userId } } }],
      },
      select: { id: true },
    });

    if (!note) throw new NotFoundException('Note not found');

    // Verification (bcrypt.compare) is adapter's responsibility
    const verified = await this.protectionPort.verifyPassword(userId, noteId, password);
    if (!verified) return { verified: false };

    // Issue time-limited unlock token on success
    const unlockToken = await this.protectionPort.issueUnlockToken(userId, noteId);
    return { verified: true, unlockToken };
  }
}
