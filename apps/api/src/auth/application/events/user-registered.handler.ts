import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { MAIL_SENDER, MailSender } from '../ports/mail-sender.port';

@EventsHandler(UserRegisteredEvent)
export class UserRegisteredEventHandler implements IEventHandler<UserRegisteredEvent> {
  private readonly logger = new Logger(UserRegisteredEventHandler.name);

  constructor(@Inject(MAIL_SENDER) private readonly mailSender: MailSender) {}

  async handle(event: UserRegisteredEvent) {
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
