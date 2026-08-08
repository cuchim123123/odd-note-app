/** One-time payment failed: payment_intent.payment_failed */
export class HandlePaymentFailedCommand {
  constructor(
    public readonly webhookEventId: string,
    public readonly externalId: string,
    public readonly provider: string,
    public readonly failureReason: string,
    public readonly correlationId: string,
  ) {}
}
