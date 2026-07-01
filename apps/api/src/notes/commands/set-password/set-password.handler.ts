import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetPasswordCommand } from './set-password.command';
import { NOTE_PROTECTION_PORT, type INoteProtectionPort } from '../../application/ports/note-protection.port';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';

/**
 * Loads the NoteEntity aggregate (enforcing ownership via NoteEntity.markAsProtected()),
 * then delegates the actual bcrypt hashing to the INoteProtectionPort adapter.
 *
 * Previous version bypassed the aggregate and went straight to Prisma, which:
 *  - Skipped domain invariant checks
 *  - Never fired NotePasswordSetDomainEvent
 * This version restores correct hexagonal flow.
 */
@CommandHandler(SetPasswordCommand)
export class SetPasswordHandler implements ICommandHandler<SetPasswordCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_PROTECTION_PORT)
    private readonly protectionPort: INoteProtectionPort,
  ) {}

  async execute(command: SetPasswordCommand): Promise<{ isProtected: true }> {
    const { userId, noteId, password } = command;

    // Load and authorize via the aggregate (throws NotePermissionDeniedError if not owner)
    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    // markAsProtected() verifies ownership and raises NotePasswordSetDomainEvent
    note.markAsProtected(userId);

    // Persist aggregate state changes (isProtected flag)
    await this.noteRepository.save(note);

    // Delegate bcrypt hashing to the infrastructure port (single responsibility)
    await this.protectionPort.setPassword(userId, noteId, password);

    return { isProtected: true };
  }
}
