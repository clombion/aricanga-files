import { Runtime } from '../host/runtime';
import type { Host } from '../host/runtime';
import type { InkRuntime } from '../ink/ink-runtime';
import type { RenderContext } from '../sim/context';
import type { Input } from '../sim/input';
import type { Router } from '../sim/router';
import type { Snapshot, SystemId } from '../sim/snapshot';
import type { AnySystem } from '../sim/system';

/** @public */
export interface ExperienceConfig {
  readonly ink: InkRuntime;
  readonly systems: readonly AnySystem[];
  readonly host: Host;
  readonly foreground?: SystemId;
  readonly router?: Router;
  readonly seed?: number;
}

/** @public */
export interface Experience {
  /** Inject an inbound value (story routed by tag; player/resume by target). */
  send(input: Input<unknown>, target?: SystemId): void;
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
    restore: (snap) =>{  runtime.restore(snap); },
    send: (input, target) =>{  runtime.send(input, target); },
    snapshot: () => runtime.snapshot(),
    step: () => runtime.step(),
    view: (id, render) => runtime.view(id, render),
  };
}
