import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '../../application/ports/note-outbox.port';
import { NOTE_SHARE_REPOSITORY, type INoteShareRepository } from '../../application/ports/note-share.repository.port';
import { USER_READ_PORT, type IUserReadPort } from '../../application/ports/user-read.port';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { NoteAlreadySharedError } from '../../domain/errors/note.errors';
import { MailerService } from '../../../common/mailer/mailer.service';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    @Inject(NOTE_SHARE_REPOSITORY)
    private readonly noteShareRepository: INoteShareRepository,
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outbox: INoteOutboxPort,
    @Inject(USER_READ_PORT)
    private readonly userReadPort: IUserReadPort,
    private readonly mailer: MailerService,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    // Load aggregate
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to share it');
    }

    // Cross-aggregate user read via port (no raw Prisma in application layer)
    const recipient = await this.userReadPort.findByEmail(recipientEmail);
    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }
    if (recipient.id === userId) {
      throw new BadRequestException('You cannot share a note with yourself');
    }

    // Domain invariant: shareWith() throws NoteAlreadySharedError / NotePermissionDeniedError
    const permissionVO = SharePermission.create(permission);
    try {
      note.shareWith(recipient.id, recipient.email, permissionVO, userId);
    } catch (err) {
      if (err instanceof NoteAlreadySharedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    // Persist aggregate state
    await this.noteRepository.save(note);

    // Persist NoteShare record via port
    const share = await this.noteShareRepository.create({
      noteId,
      ownerId: userId,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      permission,
    });

    // Fetch owner display name for the notification email via port
    const owner = await this.userReadPort.findById(userId);
    await this.mailer.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: note.title,
      noteId: note.id,
      permission,
      appUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    });

    // Dispatch NoteShared integration event via outbox port
    await this.outbox.scheduleIntegrationEvent('NoteShared', {
      noteId,
      shareId: share.id,
      ownerId: userId,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      permission,
      noteTitle: note.title,
    });

    return { id: share.id };
  }
}
