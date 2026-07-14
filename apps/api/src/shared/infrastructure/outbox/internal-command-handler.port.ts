/**
 * Token used to inject all registered internal-command handlers
 * into the OutboxProcessor via multi-provider injection.
 */
export const INTERNAL_COMMAND_HANDLERS = Symbol('INTERNAL_COMMAND_HANDLERS');

/**
 * Port for handling INTERNAL_COMMAND outbox messages.
 *
 * Each bounded context (e.g. auth) registers its own implementation
 * to handle the internal commands it owns (e.g. SendVerificationEmail).
 *
 * The OutboxProcessor calls canHandle() to find the right handler,
 * keeping the processor itself free of any domain-specific logic.
 */
export interface IInternalCommandHandler {
  /** Returns true if this handler is responsible for the given topic. */
  canHandle(topic: string): boolean;

  /** Executes the internal command with the given payload. */
  handle(topic: string, payload: Record<string, unknown>): Promise<void>;
}
