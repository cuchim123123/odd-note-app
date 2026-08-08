/**
 * ProviderReference — an opaque reference to an external payment provider record.
 * The domain never interprets the externalId — only the infrastructure layer does.
 * This keeps provider-specific concepts (Stripe session ID, Momo transaction ID) out of the domain.
 */
export type PaymentProvider = 'stripe' | 'momo' | 'mock';

export class ProviderReference {
  private constructor(
    public readonly provider: PaymentProvider,
    public readonly externalId: string,
  ) {}

  static of(provider: PaymentProvider, externalId: string): ProviderReference {
    if (!externalId || externalId.trim().length === 0) {
      throw new Error('ProviderReference: externalId cannot be blank');
    }
    return new ProviderReference(provider, externalId);
  }

  equals(other: ProviderReference): boolean {
    return this.provider === other.provider && this.externalId === other.externalId;
  }

  toString(): string {
    return `${this.provider}:${this.externalId}`;
  }
}
