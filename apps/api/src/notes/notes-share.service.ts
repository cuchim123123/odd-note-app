import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../common/mailer/mailer.service';
import { RedisService } from '../redis/redis.service';
import { REDIS_CHANNELS, REDIS_EVENT_TYPES } from '../collaboration/collaboration.constants';

export type SharePermission = 'READ' | 'EDIT';

export type NoteShareResponse = {
  id: string;
  recipientEmail: string;
  recipientDisplayName?: string | undefined;
  permission: SharePermission;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class NotesShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly redis: RedisService,
  ) {}

  async ensureOwnedNote(userId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.userId !== userId) {
      throw new UnauthorizedException('You do not own this note');
    }
  }

  async listShares(userId: string, noteId: string): Promise<NoteShareResponse[]> {
    await this.ensureOwnedNote(userId, noteId);

    const shares = await this.prisma.noteShare.findMany({
      where: { noteId, ownerId: userId },
      include: { recipient: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((share) => ({
      id: share.id,
      recipientEmail: share.recipientEmail,
      recipientDisplayName: share.recipient?.displayName ?? undefined,
      permission: share.permission as SharePermission,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    }));
  }

  async createShare(
    userId: string,
    noteId: string,
    input: { recipientEmail: string; permission: SharePermission },
  ): Promise<NoteShareResponse> {
    await this.ensureOwnedNote(userId, noteId);

    const recipientEmail = input.recipientEmail.trim().toLowerCase();
    const recipient = await this.prisma.user.findUnique({ where: { email: recipientEmail } });

    if (!recipient) {
      throw new BadRequestException('Recipient must already have an account');
    }

    const owner = await this.prisma.user.findUnique({ where: { id: userId } });
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });

    if (!owner || !note) {
      throw new NotFoundException('User or note not found');
    }

    const share = await this.prisma.noteShare.upsert({
      where: { noteId_recipientEmail: { noteId, recipientEmail } },
      update: {
        ownerId: userId,
        recipientId: recipient.id,
        permission: input.permission,
      },
      create: {
        noteId,
        ownerId: userId,
        recipientId: recipient.id,
        recipientEmail,
        permission: input.permission,
      },
      include: { recipient: { select: { displayName: true } } },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    try {
      await this.mailer.sendNoteSharedEmail({
        to: recipientEmail,
        recipientName: recipient.displayName,
        senderName: owner.displayName,
        noteTitle: note.title,
        noteId: note.id,
        permission: input.permission,
        appUrl,
      });
    } catch (error) {
      console.error('Failed to send share notification email:', error);
    }

    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: recipient.id,
          type: 'note_shared',
          title: `${owner.displayName} shared "${note.title}" with you`,
          message: `You received a ${input.permission === 'EDIT' ? 'editable' : 'read-only'} note: "${note.title}"`,
          data: JSON.stringify({
            noteId: note.id,
            shareId: share.id,
            sharedByUserId: userId,
          }),
        },
      });

      // Publish event to Redis for real-time delivery
      await this.redis.getClient().publish(REDIS_CHANNELS.COLLABORATION_EVENTS, JSON.stringify({
        type: REDIS_EVENT_TYPES.NOTIFICATION_CREATED,
        userId: recipient.id,
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          data: JSON.parse(notification.data || '{}'),
          createdAt: notification.createdAt.toISOString(),
        }
      }));
    } catch (error) {
      console.error('Failed to create notification record:', error);
    }

    void this.notifyCollaborationChange(noteId, 'permissions_updated');

    return {
      id: share.id,
      recipientEmail: share.recipientEmail,
      recipientDisplayName: share.recipient?.displayName,
      permission: share.permission as SharePermission,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    };
  }

  async updateShare(
    userId: string,
    noteId: string,
    shareId: string,
    input: { permission: SharePermission },
  ): Promise<NoteShareResponse> {
    await this.ensureOwnedNote(userId, noteId);

    const share = await this.prisma.noteShare.findFirst({
      where: { id: shareId, noteId, ownerId: userId },
      include: { recipient: { select: { displayName: true } } },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const updated = await this.prisma.noteShare.update({
      where: { id: shareId },
      data: { permission: input.permission },
      include: { recipient: { select: { displayName: true } } },
    });

    void this.notifyCollaborationChange(noteId, 'permissions_updated');

    return {
      id: updated.id,
      recipientEmail: updated.recipientEmail,
      recipientDisplayName: updated.recipient?.displayName ?? undefined,
      permission: updated.permission as SharePermission,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteShare(userId: string, noteId: string, shareId: string): Promise<{ removed: true }> {
    await this.ensureOwnedNote(userId, noteId);

    const share = await this.prisma.noteShare.findFirst({
      where: { id: shareId, noteId, ownerId: userId },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.prisma.noteShare.delete({ where: { id: shareId } });
    void this.notifyCollaborationChange(noteId, 'permissions_updated');

    return { removed: true };
  }

  private async notifyCollaborationChange(noteId: string, type: 'permissions_updated' | 'note_deleted'): Promise<void> {
    try {
      await this.redis.getClient().publish(REDIS_CHANNELS.COLLABORATION_EVENTS, JSON.stringify({ type, noteId }));
    } catch (err) {
      console.error('Failed to publish collaboration event', err);
    }
  }
}
