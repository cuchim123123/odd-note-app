import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { NOTE_REPOSITORY, type INoteRepository } from '../../application/ports/note.repository.port';
import { Inject } from '@nestjs/common';
import { SharePermission } from '../../domain/value-objects/share-permission.vo';
import { MailerService } from '../../../common/mailer/mailer.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NoteAlreadySharedError } from '../../domain/errors/note.errors';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: INoteRepository,
    private readonly prisma: PrismaService, // For user lookup and noteShare persistence (outside Note aggregate)
    private readonly mailer: MailerService,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    // Load aggregate
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to share it');
    }

    // Lookup recipient from user store (cross-aggregate query — acceptable in handler)
    const recipient = await this.prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true, email: true },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient user not found');
    }

    if (recipient.id === userId) {
      throw new BadRequestException('You cannot share a note with yourself');
    }

    // Domain invariant: shareWith() throws NoteAlreadySharedError and NotePermissionDeniedError
    // via the aggregate's internal guards
    const permissionVO = SharePermission.create(permission);
    try {
      note.shareWith(recipient.id, recipient.email, permissionVO, userId);
    } catch (err) {
      if (err instanceof NoteAlreadySharedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    // Persist aggregate state (shareWith added the share to props.shares)
    await this.noteRepository.save(note);

    // Persist the NoteShare join record (required for DB querying)
    // The aggregate tracks share state in memory; the DB record is its persistence representation
    const share = await this.prisma.noteShare.create({
      data: {
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      },
    });

    // Fetch owner name for email
    const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await this.mailer.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: note.title,
      noteId: note.id,
      permission,
      appUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    });

    // Phase 4: NoteSharedDomainEvent -> Outbox -> Notifications module via Integration Events
    await this.prisma.outboxMessage.create({
      data: {
        type: 'INTEGRATION_EVENT',
        topic: 'NoteShared',
        payload: JSON.stringify({
          noteId,
          shareId: share.id,
          ownerId: userId,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          permission,
          noteTitle: note.title,
        }),
        status: 'PENDING',
      },
    });

    return { id: share.id };
  }
}
