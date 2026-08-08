/** Recurring renewal charged successfully: invoice.payment_succeeded */
export class HandleSubscriptionRenewedCommand {
  constructor(
    public readonly webhookEventId: string,
    public readonly stripeSubscriptionId: string,
    public readonly provider: string,
    public readonly newPeriodEndTimestamp: number, // Unix timestamp from Stripe
    public readonly correlationId: string,
  ) {}
}
