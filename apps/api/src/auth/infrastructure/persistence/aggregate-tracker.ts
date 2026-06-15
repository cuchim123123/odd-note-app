import type { AggregateRoot } from '../../../common/ddd/aggregate-root';

export interface AggregateTracker {
  track(aggregate: AggregateRoot): void;
}
