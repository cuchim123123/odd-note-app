import type { AggregateRoot } from '../../../domain/shared/aggregate-root';

export interface AggregateTracker {
  track(aggregate: AggregateRoot): void;
}
