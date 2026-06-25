import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateShareCommand } from './update-share.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NOTE_SHARE_REPOSITORY, type INoteShareRepository } from '../../application/ports/note-share.repository.port';
import { NoteNotFoundError } from '../../domain/errors/note.errors';
import { ShareNotFoundError } from '../../domain/errors/share.errors';

@CommandHandler(UpdateShareCommand)
export class UpdateShareHandler implements ICommandHandler<UpdateShareCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_SHARE_REPOSITORY)
    private readonly noteShareRepository: INoteShareRepository,
  ) {}

  async execute(command: UpdateShareCommand): Promise<{ id: string }> {
    const { userId, noteId, shareId, permission } = command;

    const note = await this.noteRepository.findById(noteId);
    if (!note) throw new NoteNotFoundError(noteId);

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) throw new ShareNotFoundError(shareId);

    const newPermissionVO = SharePermission.create(permission);
    note.updateShare(shareId, newPermissionVO, userId);

    await this.noteRepository.save(note);
    const updatedShare = await this.noteShareRepository.updatePermission(shareId, permission);
    return { id: updatedShare.id };
  }
}
