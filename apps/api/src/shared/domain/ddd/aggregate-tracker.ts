import type { AggregateRoot } from './aggregate-root';

export interface AggregateTracker {
  track(aggregate: AggregateRoot): void;
}
