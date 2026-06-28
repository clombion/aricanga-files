import { type Host, Runtime } from '../host/runtime';
import type { InkRuntime } from '../ink/ink-runtime';
import type { RenderContext } from '../sim/context';
import type { Command, Input } from '../sim/input';
import type { Router } from '../sim/router';
import type { Snapshot, SystemId } from '../sim/snapshot';
import type { AnySystem } from '../sim/system';

export interface ExperienceConfig {
  readonly ink: InkRuntime;
  readonly systems: ReadonlyArray<AnySystem>;
  readonly host: Host;
  readonly foreground?: SystemId;
  readonly router?: Router;
  readonly seed?: number;
}

export interface Experience {
  /** Inject an inbound value (story routed by tag; player/resume by target). */
  send(input: Input<unknown, Command>, target?: SystemId): void;
  /** Advance ink one step if ready; returns whether it advanced. */
  step(): boolean;
  view(id: SystemId, render: RenderContext): unknown;
  snapshot(): Snapshot;
  restore(snap: Snapshot): void;
}

// Composition root — instance-scoped, no singletons (ADR-0005). It builds the
// generic runtime over the chosen systems + host and exposes the experience
// surface. The runtime owns the loop; this just wires and delegates.
export function createExperience(config: ExperienceConfig): Experience {
  const runtime = new Runtime(config);
  return {
    send: (input, target) => runtime.send(input, target),
    step: () => runtime.step(),
    view: (id, render) => runtime.view(id, render),
    snapshot: () => runtime.snapshot(),
    restore: (snap) => runtime.restore(snap),
  };
}
