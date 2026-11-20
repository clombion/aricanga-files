import type { AnySystem } from './system';
import type { InkStep } from './story';
import type { SystemId } from './snapshot';

/** @public */
interface RouteContext {
  readonly foreground: SystemId;
  readonly systems: Readonly<ReadonlyMap<SystemId, Readonly<AnySystem>>>;
}

/** Picks the system an ink step is delivered to. */
interface Router {
  readonly route: (step: InkStep, ctx: RouteContext) => SystemId;
}

/** At most one system may claim the tags of a step. */
const MAX_CLAIMERS = 1;

/**
 * Default strategy: route to the system whose `tags` claim a tag present in the
 * step; else the foreground system. Fails loud when two or more systems claim tags in
 * the same step — that genuine ambiguity needs the deferred `# system:` override
 * (ADR-0005). The registry preserves insertion order, so "first claimer" is stable.
 *
 * @returns {Router} The tag-ownership router.
 */
function createTagOwnershipRouter(): Router {
  return {
    route: (step, ctx) => {
      const stepKeys = new Set(step.tags.map((tag) => tag.key));
      const claimers: SystemId[] = [];
      for (const [id, system] of ctx.systems) {
        if (system.tags.some((tag) => stepKeys.has(tag))) {
          claimers.push(id);
        }
      }
      if (claimers.length > MAX_CLAIMERS) {
        throw new Error(
          `Ambiguous routing: systems [${claimers.join(', ')}] all claim tags in this step; ` +
            'a "# system:" override is required (not yet implemented).',
        );
      }
      const [claimer = ctx.foreground] = claimers;
      return claimer;
    },
  };
}

export { createTagOwnershipRouter };
export type { RouteContext, Router };
