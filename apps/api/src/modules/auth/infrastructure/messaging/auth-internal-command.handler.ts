import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IInternalCommandHandler } from '../../../../shared/infrastructure/outbox/internal-command-handler.port';
import { MAIL_SENDER, type MailSender } from '../../application/ports/mail-sender.port';

/**
 * Handles INTERNAL_COMMAND outbox messages owned by the Auth bounded context.
 *
 * Registered with the INTERNAL_COMMAND_HANDLERS multi-provider token so the
 * generic OutboxProcessor can delegate to it without any auth-specific knowledge.
 */
@Injectable()
export class AuthInternalCommandHandler implements IInternalCommandHandler {
  private readonly logger = new Logger(AuthInternalCommandHandler.name);

  private readonly SUPPORTED_TOPICS = new Set([
    'SendVerificationEmail',
    'SendPasswordResetEmail',
  ]);

  constructor(
    @Inject(MAIL_SENDER)
    private readonly mailSender: MailSender,
  ) {}

  canHandle(topic: string): boolean {
    return this.SUPPORTED_TOPICS.has(topic);
  }

  async handle(topic: string, payload: Record<string, unknown>): Promise<void> {
    switch (topic) {
      case 'SendVerificationEmail':
        await this.mailSender.sendVerificationEmail(
          payload.email as string,
          payload.displayName as string,
          payload.verificationToken as string,
        );
        break;

      case 'SendPasswordResetEmail':
        await this.mailSender.sendPasswordResetEmail(
          payload.email as string,
          payload.resetToken as string,
        );
        break;

      default:
        this.logger.warn(`AuthInternalCommandHandler received unknown topic: "${topic}"`);
    }
  }
}
