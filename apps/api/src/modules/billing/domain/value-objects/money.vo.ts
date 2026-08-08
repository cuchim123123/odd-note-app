/**
 * Money — an immutable, validated value object for monetary amounts.
 * Amounts are always in the smallest currency unit (cents for USD, dong for VND).
 * Arithmetic is intentionally NOT supported — domain logic should never mutate money.
 */
export type SupportedCurrency = 'USD' | 'VND';

export class Money {
  private constructor(
    public readonly amountCents: number,
    public readonly currency: SupportedCurrency,
  ) {}

  static of(amountCents: number, currency: SupportedCurrency): Money {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new Error(`Money: amountCents must be a non-negative integer, got ${amountCents}`);
    }
    return new Money(amountCents, currency);
  }

  static zero(currency: SupportedCurrency = 'USD'): Money {
    return new Money(0, currency);
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.amountCents === 0;
  }

  toString(): string {
    return `${this.amountCents} ${this.currency}`;
  }
}
