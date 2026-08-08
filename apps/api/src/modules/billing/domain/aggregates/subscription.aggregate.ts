import { AggregateRoot } from '@shared/domain/ddd/aggregate-root';
import { uuidv7 } from 'uuidv7';
import type { BillingEntityId } from '@modules/billing/domain/value-objects/billing-entity-id.vo';
import type { PlanVersion } from '@modules/billing/domain/value-objects/plan-version.vo';
import type { Plan } from '@modules/billing/domain/entities/plan.entity';
import type { Payment } from '@modules/billing/domain/aggregates/payment.aggregate';
import { SubscriptionActivatedDomainEvent } from '@modules/billing/domain/events/subscription-activated.domain-event';
import { SubscriptionRenewedDomainEvent } from '@modules/billing/domain/events/subscription-renewed.domain-event';
import { SubscriptionPaymentFailedDomainEvent } from '@modules/billing/domain/events/subscription-payment-failed.domain-event';
import { SubscriptionCancelledDomainEvent } from '@modules/billing/domain/events/subscription-cancelled.domain-event';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

// ─── Errors ───────────────────────────────────────────────────────────────────

export class SubscriptionAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Subscription ${id} is already cancelled or expired.`);
    this.name = 'SubscriptionAlreadyCancelledError';
  }
}

export class SubscriptionNotActiveError extends Error {
  constructor(id: string, status: SubscriptionStatus) {
    super(`Subscription ${id} cannot be renewed — current status: ${status}.`);
    this.name = 'SubscriptionNotActiveError';
  }
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export class Subscription extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _billingEntityId: BillingEntityId,
    private readonly _planVersion: PlanVersion,
    private readonly _paymentId: string,
    private _status: SubscriptionStatus,
    private readonly _features: string[],
    private _currentPeriodStart: Date,
    private _currentPeriodEnd: Date,
    private _stripeSubscriptionId: string | null,
    private _cancelledAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get id(): string { return this._id; }
  get billingEntityId(): string { return this._billingEntityId; }
  get planVersion(): PlanVersion { return this._planVersion; }
  get paymentId(): string { return this._paymentId; }
  get status(): SubscriptionStatus { return this._status; }
  get features(): ReadonlyArray<string> { return this._features; }
  get currentPeriodStart(): Date { return this._currentPeriodStart; }
  get currentPeriodEnd(): Date { return this._currentPeriodEnd; }
  get stripeSubscriptionId(): string | null { return this._stripeSubscriptionId; }
  get cancelledAt(): Date | null { return this._cancelledAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // ─── Factory ──────────────────────────────────────────────────────────────

  /**
   * Creates a new Subscription from a confirmed Payment.
   * The plan's feature list is snapshotted at this moment.
   */
  static activate(payment: Payment, plan: Plan, correlationId: string): Subscription {
    const now = new Date();
    const periodEnd = plan.computePeriodEnd(now);
    const id = uuidv7();

    const sub = new Subscription(
      id,
      payment.billingEntityId as BillingEntityId,
      payment.planVersion,
      payment.id,
      'ACTIVE',
      [...plan.features],
      now,
      periodEnd ?? now,    // lifetime plans: currentPeriodEnd = createdAt (no expiry logic)
      null,
      null,
      now,
      now,
    );

    sub.addDomainEvent(
      new SubscriptionActivatedDomainEvent(
        id,
        payment.billingEntityId,
        plan.id,
        plan.version,
        [...plan.features],
        periodEnd,
        correlationId,
      ),
    );

    return sub;
  }

  // ─── State Transitions ────────────────────────────────────────────────────

  /**
   * Stripe charged the card again for a recurring plan.
   * ACTIVE | PAST_DUE → ACTIVE with new period
   */
  renew(newPeriodEnd: Date, correlationId: string): void {
    if (this._status === 'CANCELLED' || this._status === 'EXPIRED') {
      throw new SubscriptionAlreadyCancelledError(this._id);
    }
    const now = new Date();
    this._status = 'ACTIVE';
    this._currentPeriodStart = now;
    this._currentPeriodEnd = newPeriodEnd;
    this._updatedAt = now;

    this.addDomainEvent(
      new SubscriptionRenewedDomainEvent(
        this._id,
        this._billingEntityId,
        this._planVersion.planId,
        newPeriodEnd,
        correlationId,
      ),
    );
  }

  /**
   * Renewal payment failed — enter grace period.
   * ACTIVE → PAST_DUE
   */
  markPastDue(correlationId: string): void {
    if (this._status !== 'ACTIVE') {
      throw new SubscriptionNotActiveError(this._id, this._status);
    }
    this._status = 'PAST_DUE';
    this._updatedAt = new Date();

    this.addDomainEvent(
      new SubscriptionPaymentFailedDomainEvent(
        this._id,
        this._billingEntityId,
        this._planVersion.planId,
        correlationId,
      ),
    );
  }

  /**
   * User or provider cancelled the subscription.
   * ACTIVE | PAST_DUE → CANCELLED
   */
  cancel(correlationId: string): void {
    if (this._status === 'CANCELLED' || this._status === 'EXPIRED') {
      throw new SubscriptionAlreadyCancelledError(this._id);
    }
    const now = new Date();
    this._status = 'CANCELLED';
    this._cancelledAt = now;
    this._updatedAt = now;

    this.addDomainEvent(
      new SubscriptionCancelledDomainEvent(
        this._id,
        this._billingEntityId,
        this._planVersion.planId,
        correlationId,
      ),
    );
  }

  /**
   * Recovery: renewal succeeded after PAST_DUE.
   * PAST_DUE → ACTIVE
   */
  reactivate(newPeriodEnd: Date, correlationId: string): void {
    this.renew(newPeriodEnd, correlationId); // same logic — reuse renew()
  }

  /**
   * Attaches the Stripe Subscription ID for recurring webhook correlation.
   * Called once when Stripe creates the recurring subscription object.
   */
  attachStripeSubscriptionId(stripeSubscriptionId: string): void {
    this._stripeSubscriptionId = stripeSubscriptionId;
    this._updatedAt = new Date();
  }

  // ─── Reconstitution ───────────────────────────────────────────────────────

  static reconstitute(props: {
    id: string;
    billingEntityId: BillingEntityId;
    planVersion: PlanVersion;
    paymentId: string;
    status: SubscriptionStatus;
    features: string[];
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeSubscriptionId: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Subscription {
    return new Subscription(
      props.id,
      props.billingEntityId,
      props.planVersion,
      props.paymentId,
      props.status,
      props.features,
      props.currentPeriodStart,
      props.currentPeriodEnd,
      props.stripeSubscriptionId,
      props.cancelledAt,
      props.createdAt,
      props.updatedAt,
    );
  }
}
