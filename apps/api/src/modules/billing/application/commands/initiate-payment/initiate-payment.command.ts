export class InitiatePaymentCommand {
  constructor(
    /** The user ID — wrapped in BillingEntityId inside the handler */
    public readonly userId: string,
    /** Must be an active plan ID from the catalog */
    public readonly planId: string,
    /**
     * Client-provided unique key for this payment initiation attempt.
     * Prevents duplicate payments if the request is retried.
     * The server validates uniqueness but never trusts the client for pricing.
     */
    public readonly idempotencyKey: string,
    /** Propagated from the incoming HTTP request for distributed tracing */
    public readonly correlationId: string,
  ) {}
}
