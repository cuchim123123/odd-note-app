/** One-time payment confirmed: checkout.session.completed */
export class HandlePaymentSucceededCommand {
  constructor(
    public readonly webhookEventId: string,
    public readonly externalId: string,
    public readonly provider: string,
    public readonly correlationId: string,
  ) {}
}
