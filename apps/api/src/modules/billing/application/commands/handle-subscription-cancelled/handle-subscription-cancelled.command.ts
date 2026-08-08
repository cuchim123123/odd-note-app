/** Subscription deleted by user or provider: customer.subscription.deleted */
export class HandleSubscriptionCancelledCommand {
  constructor(
    public readonly webhookEventId: string,
    public readonly stripeSubscriptionId: string,
    public readonly provider: string,
    public readonly correlationId: string,
  ) {}
}
