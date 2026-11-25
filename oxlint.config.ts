// The gate's lint run: the config of `harness/lib/oxlint-config.ts` over the repository's population.
// oxlint loads it with Node (its TypeScript config is experimental at the pinned 1.94); the population
// is fixed when it loads. A failure while it loads stays failed for that process: a module's
// failed top-level await is kept by the module cache, so a long-lived process that meets one starts again.

import type { GateOxlintConfig } from './harness/lib/oxlint-shape.ts';
import { oxlintConfigOf } from './harness/lib/oxlint-config.ts';
import { population } from './harness/lib/scope.ts';

const config: GateOxlintConfig = oxlintConfigOf(await population());

// oxlint loads a config module's default export.
export default config;
