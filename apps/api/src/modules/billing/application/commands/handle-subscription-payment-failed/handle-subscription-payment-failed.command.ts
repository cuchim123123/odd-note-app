/** Renewal charge failed: invoice.payment_failed */
export class HandleSubscriptionPaymentFailedCommand {
  constructor(
    public readonly webhookEventId: string,
    public readonly stripeSubscriptionId: string,
    public readonly provider: string,
    public readonly correlationId: string,
  ) {}
}
