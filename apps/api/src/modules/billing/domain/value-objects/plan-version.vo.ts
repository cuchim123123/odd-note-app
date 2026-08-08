/**
 * PlanVersion — a snapshot reference to the exact plan version purchased.
 * Immutable after creation. Stored on Payment and Subscription aggregates
 * so that plan changes never retroactively affect existing records.
 */
export class PlanVersion {
  private constructor(
    public readonly planId: string,
    public readonly version: number,
  ) {}

  static of(planId: string, version: number): PlanVersion {
    if (!planId || planId.trim().length === 0) {
      throw new Error('PlanVersion: planId cannot be blank');
    }
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`PlanVersion: version must be a positive integer, got ${version}`);
    }
    return new PlanVersion(planId, version);
  }

  equals(other: PlanVersion): boolean {
    return this.planId === other.planId && this.version === other.version;
  }

  toString(): string {
    return `${this.planId}@v${this.version}`;
  }
}
