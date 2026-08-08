import type { SupportedCurrency } from '@modules/billing/domain/value-objects/money.vo';

/**
 * Plan — a domain entity representing a versioned product in the billing catalog.
 * Plans are NEVER deleted, only deprecated (isActive = false).
 * Subscriptions snapshot the plan version at activation time for grandfathering.
 */
export class Plan {
  constructor(
    public readonly id: string,
    public readonly version: number,
    public readonly displayName: string,
    public readonly amountCents: number,
    public readonly currency: SupportedCurrency,
    public readonly intervalDays: number | null,
    public readonly features: ReadonlyArray<string>,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly deprecatedAt: Date | null,
  ) {}

  get isLifetime(): boolean {
    return this.intervalDays === null;
  }

  get isFree(): boolean {
    return this.amountCents === 0;
  }

  /**
   * Computes the period end date from a given start date.
   * Returns null for lifetime/one-time plans.
   */
  computePeriodEnd(from: Date): Date | null {
    if (this.intervalDays === null) return null;
    const end = new Date(from);
    end.setDate(end.getDate() + this.intervalDays);
    return end;
  }

  static reconstitute(props: {
    id: string;
    version: number;
    displayName: string;
    amountCents: number;
    currency: string;
    intervalDays: number | null;
    features: string[];
    isActive: boolean;
    createdAt: Date;
    deprecatedAt: Date | null;
  }): Plan {
    return new Plan(
      props.id,
      props.version,
      props.displayName,
      props.amountCents,
      props.currency as SupportedCurrency,
      props.intervalDays,
      props.features,
      props.isActive,
      props.createdAt,
      props.deprecatedAt,
    );
  }
}
