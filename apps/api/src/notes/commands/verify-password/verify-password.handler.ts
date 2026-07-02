import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { VerifyPasswordCommand } from './verify-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';

/**
 * Verifies the user-supplied password against the note's stored bcrypt hash.
 * On success, issues a short-lived unlock JWT for subsequent content requests.
 *
 * A-1 fix: replaces direct PrismaService injection with INoteRepository port.
 * Access check is now done via NoteEntity.hasAccess() — keeping the
 * authorization rule inside the domain aggregate rather than in raw SQL.
 */
@CommandHandler(VerifyPasswordCommand)
export class VerifyPasswordHandler implements ICommandHandler<VerifyPasswordCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(command: VerifyPasswordCommand): Promise<{ verified: boolean; unlockToken?: string }> {
    const { userId, noteId, password } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    // Domain aggregate enforces the access check — owner or any share recipient
    if (!note.hasAccess(userId)) throw new NoteNotFoundError(noteId); // 404 to avoid oracle

    const verified = await this.protectionPort.verifyPassword(userId, noteId, password);
    if (!verified) return { verified: false };

    const unlockToken = await this.protectionPort.issueUnlockToken(userId, noteId);
    return { verified: true, unlockToken };
  }
}
