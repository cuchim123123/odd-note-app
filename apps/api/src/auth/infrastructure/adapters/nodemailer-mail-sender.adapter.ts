import { Injectable } from '@nestjs/common';
import type { MailSender } from '../../application/ports/mail-sender.port';
import { MailerService } from '../../../common/mailer/mailer.service';
import { AuthUrlService } from '../../../common/auth-url.service';

@Injectable()
export class NodemailerMailSender implements MailSender {
  constructor(
    private readonly mailerService: MailerService,
    private readonly authUrlService: AuthUrlService,
  ) {}

  async sendVerificationEmail(to: string, displayName: string, verificationToken: string): Promise<void> {
    const verificationUrl = this.authUrlService.buildVerificationEmailUrl(verificationToken);
    await this.mailerService.sendVerificationEmail({
      to,
      displayName,
      verificationUrl,
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = this.authUrlService.buildResetPasswordUrl(resetToken);
    await this.mailerService.sendPasswordResetEmail(to, resetUrl);
  }
}
