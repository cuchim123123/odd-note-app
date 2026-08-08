export const ENTITLEMENT_REPOSITORY = Symbol('ENTITLEMENT_REPOSITORY');

export interface UpsertEntitlementDto {
  billingEntityId: string;
  features: string[];
  expiresAt: Date | null;
}

export interface IEntitlementRepository {
  upsert(dto: UpsertEntitlementDto): Promise<void>;
  findByBillingEntityId(billingEntityId: string): Promise<{ features: string[]; expiresAt: Date | null } | null>;
}
