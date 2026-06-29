import type { Effect } from './effect';
import type { Command, Input } from './input';
import type { SystemId } from './snapshot';

// One reduction, as the kernel observes it — the unit of the `Input→Effect`+`state`
// stream (testing-strategy.md). The whole correlated triple, visible only at the
// reduce boundary. Treated as immutable; an observer that retains it should copy.
export interface ReduceRecord {
  readonly systemId: SystemId;
  readonly input: Input<unknown, Command>;
  readonly effects: readonly Effect[];
  readonly state: unknown;
}

// The runtime's reduce-trace observability seam — a peer of the host's effect
// sinks, not a new `Input`/`Effect` (the kernel algebra is untouched). The test
// harness records it for goldens/determinism; analytics (task-058) forwards it.
export interface ReduceObserver {
  observe(record: ReduceRecord): void;
}
