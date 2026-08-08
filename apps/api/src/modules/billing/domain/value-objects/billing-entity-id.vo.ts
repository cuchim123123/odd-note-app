/**
 * BillingEntityId — opaque identifier for the party being billed.
 * Currently wraps a userId. In the future will also wrap organizationId.
 * Domain aggregates (Payment, Subscription) carry this type — never a raw userId string.
 */

declare const __billingBrand: unique symbol;
export type BillingEntityId = string & { readonly [__billingBrand]: 'BillingEntityId' };

export type BillingEntityType = 'user' | 'org';

export interface BillingEntityIdProps {
  value: BillingEntityId;
  type: BillingEntityType;
}

export const BillingEntityId = {
  fromUser(userId: string): BillingEntityId {
    if (!userId || userId.trim().length === 0) {
      throw new Error('BillingEntityId: userId cannot be blank');
    }
    return userId as BillingEntityId;
  },

  /** Reserved for future org billing. */
  fromOrg(orgId: string): BillingEntityId {
    if (!orgId || orgId.trim().length === 0) {
      throw new Error('BillingEntityId: orgId cannot be blank');
    }
    return orgId as BillingEntityId;
  },

  from(raw: string): BillingEntityId {
    if (!raw || raw.trim().length === 0) {
      throw new Error('BillingEntityId cannot be blank');
    }
    return raw as BillingEntityId;
  },
} as const;
