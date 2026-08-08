/**
 * IEntitlementQueryDao — read-only port for checking feature access.
 * Consumed by other modules (Notes, Collaboration) via BillingModule export.
 * Implementations: Redis cache → DB fallback.
 *
 * This is a Query DAO (read model), NOT a repository.
 * It never loads domain aggregates — only flat entitlement projections.
 */
export const ENTITLEMENT_QUERY_DAO = Symbol('ENTITLEMENT_QUERY_DAO');

export interface EntitlementResult {
  billingEntityId: string;
  features: string[];
  expiresAt: Date | null;
  /** Computed: false if expiresAt is in the past */
  isActive: boolean;
}

export interface IEntitlementQueryDao {
  findByBillingEntityId(billingEntityId: string): Promise<EntitlementResult | null>;
  hasFeature(billingEntityId: string, featureKey: string): Promise<boolean>;
}
