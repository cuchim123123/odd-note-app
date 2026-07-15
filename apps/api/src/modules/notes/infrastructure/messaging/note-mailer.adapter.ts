import { Injectable, Inject } from '@nestjs/common';
import type { EnvConfig } from '../../../../config/env.validation';
import type { INoteMailSender } from '../../application/ports/note-mail-sender.port';
import { MailerService } from '../../../../shared/infrastructure/messaging/mailer/mailer.service';

@Injectable()
export class NoteMailerAdapter implements INoteMailSender {
  constructor(
    private readonly mailer: MailerService,
    @Inject('ENV_CONFIG') private readonly env: EnvConfig,
  ) {}

  async sendNoteSharedEmail(params: {
    to: string;
    recipientName: string;
    senderName: string;
    noteTitle: string;
    noteId: string;
    permission: string;
  }): Promise<void> {
    await this.mailer.sendNoteSharedEmail({
      ...params,
      appUrl: this.env.APP_URL,
    });
  }
}
