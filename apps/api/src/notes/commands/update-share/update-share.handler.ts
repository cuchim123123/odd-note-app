import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateShareCommand } from './update-share.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NOTE_SHARE_REPOSITORY, type INoteShareRepository } from '../../application/ports/note-share.repository.port';

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

    // Load aggregate — includes share list
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to modify its shares');
    }

    const shareExists = note.shares.some((s) => s.id === shareId);
    if (!shareExists) {
      throw new NotFoundException('Share record not found');
    }

    // Domain invariant: updateShare() enforces owner-only permission change
    const newPermissionVO = SharePermission.create(permission);
    note.updateShare(shareId, newPermissionVO, userId);

    // Persist aggregate state
    await this.noteRepository.save(note);

    // Persist DB share record update via port
    const updatedShare = await this.noteShareRepository.updatePermission(shareId, permission);

    return { id: updatedShare.id };
  }
}
