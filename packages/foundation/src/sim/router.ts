import type { SystemId } from './snapshot';
import type { AnySystem } from './system';
import type { InkStep } from './story';

export interface RouteContext {
  readonly foreground: SystemId;
  readonly systems: ReadonlyMap<SystemId, AnySystem>;
}

export interface Router {
  route(step: InkStep, ctx: RouteContext): SystemId;
}

// Default strategy: route to the system whose `tags` claim a tag present in the
// step; else the foreground system. Fails loud when ≥2 systems claim tags in the
// same step — that genuine ambiguity needs the deferred `# system:` override
// (ADR-0005). The registry preserves insertion order, so "first claimer" is stable.
export function createTagOwnershipRouter(): Router {
  return {
    route(step, ctx) {
      const stepKeys = new Set(step.tags.map((t) => t.key));
      const claimers: SystemId[] = [];
      for (const [id, system] of ctx.systems) {
        if (system.tags.some((tag) => stepKeys.has(tag))) claimers.push(id);
      }
      if (claimers.length > 1) {
        throw new Error(
          `Ambiguous routing: systems [${claimers.join(', ')}] all claim tags in this step; ` +
            'a "# system:" override is required (not yet implemented).',
        );
      }
      return claimers[0] ?? ctx.foreground;
    },
  };
}
