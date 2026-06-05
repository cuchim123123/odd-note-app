import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { PasswordResetRequestedEvent } from '../../domain/events/password-reset-requested.event';
import { MAIL_SENDER, MailSender } from '../ports/mail-sender.port';

@EventsHandler(PasswordResetRequestedEvent)
export class PasswordResetRequestedEventHandler implements IEventHandler<PasswordResetRequestedEvent> {
  private readonly logger = new Logger(PasswordResetRequestedEventHandler.name);

  constructor(@Inject(MAIL_SENDER) private readonly mailSender: MailSender) {}

  async handle(event: PasswordResetRequestedEvent) {
    try {
      await this.mailSender.sendPasswordResetEmail(event.email, event.resetToken);
    } catch (error) {
      this.logger.error('Failed to send password reset email:', error);
    }
  }
}
