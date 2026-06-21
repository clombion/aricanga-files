import type { SystemId } from './snapshot';
import type { StoryChunk } from './story';
import type { System } from './system';

export interface RouteContext {
  readonly foreground: SystemId;
  readonly systems: ReadonlyMap<SystemId, System<unknown, unknown>>;
}

export interface Router {
  route(chunk: StoryChunk, ctx: RouteContext): SystemId;
}

// Default strategy: route to the system whose `tags` claim a tag present in the
// chunk; else the foreground system. Fails loud when ≥2 systems claim tags in the
// same chunk — that genuine ambiguity needs the deferred `# system:` override
// (ADR-0005). The registry preserves insertion order, so "first claimer" is stable.
export function createTagOwnershipRouter(): Router {
  return {
    route(chunk, ctx) {
      const chunkKeys = new Set(chunk.tags.map((t) => t.key));
      const claimers: SystemId[] = [];
      for (const [id, system] of ctx.systems) {
        if (system.tags.some((tag) => chunkKeys.has(tag))) claimers.push(id);
      }
      if (claimers.length > 1) {
        throw new Error(
          `Ambiguous routing: systems [${claimers.join(', ')}] all claim tags in this chunk; ` +
            'a "# system:" override is required (not yet implemented).',
        );
      }
      return claimers[0] ?? ctx.foreground;
    },
  };
}
