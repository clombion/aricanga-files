import type { Snapshot, SystemId } from '#src/sim/snapshot';
import type { AnySystem } from '#src/sim/system';
import type { Host } from '#src/host/effects';
import type { InkRuntime } from '#src/ink/ink-runtime';
import type { Input } from '#src/sim/input';
import type { RenderContext } from '#src/sim/context';
import type { Router } from '#src/sim/router';
import { Runtime } from '#src/host/runtime';

/** @public */
interface ExperienceConfig {
  readonly ink: Readonly<InkRuntime>;
  readonly systems: readonly Readonly<AnySystem>[];
  readonly host: Readonly<Host>;
  readonly foreground?: SystemId;
  readonly router?: Readonly<Router>;
  readonly seed?: number;
}

/** @public */
interface Experience {
  /** Inject an inbound value (story routed by tag; player/resume by target). */
  readonly send: (input: Input<unknown>, target?: SystemId) => void;
  /** Advance ink one step if ready; returns whether it advanced. */
  readonly step: () => boolean;
  readonly view: (id: SystemId, render: RenderContext) => unknown;
  readonly snapshot: () => Snapshot;
  readonly restore: (snap: Snapshot) => void;
}

/**
 * Composition root — instance-scoped, no singletons (ADR-0005). It builds the
 * generic runtime over the chosen systems + host and exposes the experience
 * surface. The runtime owns the loop; this just wires and delegates.
 *
 * @param {ExperienceConfig} config - The ink story, the systems and the host.
 * @returns {Experience} The experience's surface.
 */
function createExperience(config: Readonly<ExperienceConfig>): Experience {
  const runtime = new Runtime(config);
  return {
    restore: (snap) => {
      runtime.restore(snap);
    },
    send: (input, target) => {
      runtime.send(input, target);
    },
    snapshot: () => runtime.snapshot(),
    step: () => runtime.step(),
    view: (id, render) => runtime.view(id, render),
  };
}

export { createExperience };
export type { Experience, ExperienceConfig };
