import type { AggregateRoot } from '@shared/domain/ddd/aggregate-root';

export interface AggregateTracker {
  track(aggregate: AggregateRoot): void;
}
