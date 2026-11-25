// The gate's unused-code scan: the config of `harness/lib/knip-config.ts` over the repository's
// population. knip loads it (with jiti), and evaluates it once per configuration read; the population
// is fixed when it loads. A failure while it loads stays failed for that process: a module's
// failed top-level await is kept by the module cache, so a long-lived process that meets one starts again.

import type { KnipConfig } from './harness/lib/knip-config.ts';
import { knipConfigOf } from './harness/lib/knip-config.ts';
import { population } from './harness/lib/scope.ts';

const config: KnipConfig = knipConfigOf(await population());

// Knip loads a config module's default export.
export default config;
