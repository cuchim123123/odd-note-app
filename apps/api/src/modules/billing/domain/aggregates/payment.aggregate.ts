import { AggregateRoot } from '@shared/domain/ddd/aggregate-root';
import { uuidv7 } from 'uuidv7';
import type { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';
import type { Money } from '@modules/billing/domain/value-objects/money.vo';
import type { PlanVersion } from '@modules/billing/domain/value-objects/plan-version.vo';
import type { ProviderReference } from '@modules/billing/domain/value-objects/provider-reference.vo';
import { PaymentInitiatedDomainEvent } from '@modules/billing/domain/events/payment-initiated.domain-event';
import { PaymentCompletedDomainEvent } from '@modules/billing/domain/events/payment-completed.domain-event';
import { PaymentFailedDomainEvent } from '@modules/billing/domain/events/payment-failed.domain-event';

// ─── State Machine ────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_ACTION'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

const TERMINAL_STATES: ReadonlySet<PaymentStatus> = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PaymentAlreadySettledError extends Error {
  constructor(paymentId: string, currentStatus: PaymentStatus) {
    super(`Payment ${paymentId} is already in terminal state ${currentStatus}. No further transitions allowed.`);
    this.name = 'PaymentAlreadySettledError';
  }
}

export class PaymentProviderAlreadyAssignedError extends Error {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} already has a provider reference assigned.`);
    this.name = 'PaymentProviderAlreadyAssignedError';
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export class Payment extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _billingEntityId: BillingEntityId,
    private readonly _planVersion: PlanVersion,
    private readonly _quote: Money,
    private _status: PaymentStatus,
    private _providerRef: ProviderReference | null,
    private _failureReason: string | null,
    public readonly correlationId: string,
    public readonly idempotencyKey: string,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get id(): string { return this._id; }
  get billingEntityId(): string { return this._billingEntityId; }
  get planVersion(): PlanVersion { return this._planVersion; }
  get quote(): Money { return this._quote; }
  get status(): PaymentStatus { return this._status; }
  get providerRef(): ProviderReference | null { return this._providerRef; }
  get failureReason(): string | null { return this._failureReason; }
  get updatedAt(): Date { return this._updatedAt; }

  // ─── Factory ──────────────────────────────────────────────────────────────

  static initiate(params: {
    billingEntityId: BillingEntityId;
    planVersion: PlanVersion;
    quote: Money;
    providerRef: ProviderReference;
    correlationId: string;
    idempotencyKey: string;
  }): Payment {
    const now = new Date();
    const id = uuidv7();

    const payment = new Payment(
      id,
      params.billingEntityId,
      params.planVersion,
      params.quote,
      'PENDING',
      params.providerRef,
      null,
      params.correlationId,
      params.idempotencyKey,
      now,
      now,
    );

    payment.addDomainEvent(
      new PaymentInitiatedDomainEvent(
        id,
        params.billingEntityId,
        params.planVersion.planId,
        params.planVersion.version,
        params.quote.amountCents,
        params.quote.currency,
        params.correlationId,
      ),
    );

    return payment;
  }

  // ─── State Transitions ────────────────────────────────────────────────────

  /**
   * Provider confirmed the payment successfully.
   * PENDING | PROCESSING | AWAITING_ACTION → COMPLETED
   */
  complete(): void {
    this.assertNotTerminal();
    this._status = 'COMPLETED';
    this._updatedAt = new Date();
    this.addDomainEvent(
      new PaymentCompletedDomainEvent(
        this._id,
        this._billingEntityId,
        this._planVersion.planId,
        this._planVersion.version,
        this.correlationId,
      ),
    );
  }

  /**
   * Payment failed at the provider level.
   * PENDING | PROCESSING | AWAITING_ACTION → FAILED
   */
  fail(reason: string): void {
    this.assertNotTerminal();
    this._status = 'FAILED';
    this._failureReason = reason;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new PaymentFailedDomainEvent(
        this._id,
        this._billingEntityId,
        this._planVersion.planId,
        this._planVersion.version,
        reason,
        this.correlationId,
      ),
    );
  }

  /**
   * User abandoned the checkout session.
   * PENDING → CANCELLED
   */
  cancel(): void {
    this.assertNotTerminal();
    this._status = 'CANCELLED';
    this._updatedAt = new Date();
    // No domain event — cancellation is not interesting to other BCs
  }

  /**
   * Provider requires 3DS/additional authentication.
   * PENDING → AWAITING_ACTION
   */
  requireAction(): void {
    this.assertNotTerminal();
    if (this._status !== 'PENDING') {
      throw new Error(`requireAction is only valid from PENDING state, current: ${this._status}`);
    }
    this._status = 'AWAITING_ACTION';
    this._updatedAt = new Date();
  }

  /**
   * Async provider (bank transfer) began processing.
   * PENDING → PROCESSING
   */
  markAsProcessing(): void {
    this.assertNotTerminal();
    if (this._status !== 'PENDING') {
      throw new Error(`markAsProcessing is only valid from PENDING state, current: ${this._status}`);
    }
    this._status = 'PROCESSING';
    this._updatedAt = new Date();
  }

  // ─── Reconstitution (infrastructure layer only) ───────────────────────────

  static reconstitute(props: {
    id: string;
    billingEntityId: BillingEntityId;
    planVersion: PlanVersion;
    quote: Money;
    status: PaymentStatus;
    providerRef: ProviderReference | null;
    failureReason: string | null;
    correlationId: string;
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
  }): Payment {
    return new Payment(
      props.id,
      props.billingEntityId,
      props.planVersion,
      props.quote,
      props.status,
      props.providerRef,
      props.failureReason,
      props.correlationId,
      props.idempotencyKey,
      props.createdAt,
      props.updatedAt,
    );
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private assertNotTerminal(): void {
    if (TERMINAL_STATES.has(this._status)) {
      throw new PaymentAlreadySettledError(this._id, this._status);
    }
  }
}
