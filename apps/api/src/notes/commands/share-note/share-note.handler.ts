import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ShareNoteCommand } from './share-note.command';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailerService } from '../../../common/mailer/mailer.service';

@CommandHandler(ShareNoteCommand)
export class ShareNoteHandler implements ICommandHandler<ShareNoteCommand> {
  constructor(
    private readonly prisma: PrismaService, // Temporary until full UoW
    private readonly mailer: MailerService,
  ) {}

  async execute(command: ShareNoteCommand): Promise<{ id: string }> {
    const { userId, noteId, recipientEmail, permission } = command;

    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      include: { shares: { select: { recipientEmail: true } } },
    });

    if (!note) {
      throw new NotFoundException('Note not found or you do not have permission to share it');
    }

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

    const alreadyShared = note.shares.some((s) => s.recipientEmail === recipientEmail);
    if (alreadyShared) {
      throw new BadRequestException('Note is already shared with this user');
    }

    const share = await this.prisma.noteShare.create({
      data: {
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        permission,
      },
    });

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isShared: true },
    });

    const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await this.mailer.sendNoteSharedEmail({
      to: recipient.email,
      recipientName: recipient.email.split('@')[0] ?? 'User',
      senderName: owner?.displayName ?? 'A user',
      noteTitle: note.title,
      noteId: note.id,
      permission: permission,
      appUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    });

    return { id: share.id };
  }
}
