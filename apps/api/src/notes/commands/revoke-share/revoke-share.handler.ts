import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { RevokeShareCommand } from './revoke-share.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { NOTE_SHARE_REPOSITORY, type INoteShareRepository } from '../../application/ports/note-share.repository.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';
import { ShareNotFoundError } from '../../domain/errors/share.errors';

@CommandHandler(RevokeShareCommand)
export class RevokeShareHandler implements ICommandHandler<RevokeShareCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_SHARE_REPOSITORY)
    private readonly noteShareRepository: INoteShareRepository,
  ) {}

  async execute(command: RevokeShareCommand): Promise<void> {
    const { userId, noteId, shareId } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) throw new ShareNotFoundError(shareId);

    note.revokeShare(shareId, userId);

    await this.noteRepository.save(note);
    await this.noteShareRepository.delete(shareId);
  }
}
