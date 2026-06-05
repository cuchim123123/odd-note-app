import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { VerificationRequestedEvent } from '../../domain/events/verification-requested.event';
import { MAIL_SENDER, MailSender } from '../ports/mail-sender.port';

@EventsHandler(VerificationRequestedEvent)
export class VerificationRequestedEventHandler implements IEventHandler<VerificationRequestedEvent> {
  private readonly logger = new Logger(VerificationRequestedEventHandler.name);

  constructor(@Inject(MAIL_SENDER) private readonly mailSender: MailSender) {}

  async handle(event: VerificationRequestedEvent) {
    try {
      await this.mailSender.sendVerificationEmail(event.email, event.displayName, event.verificationToken);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email for ${event.email}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
