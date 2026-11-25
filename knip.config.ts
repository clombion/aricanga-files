// The gate's unused-code scan: the config of `harness/lib/knip-config.ts` over the repository's
// population. knip loads it (with jiti), and evaluates it once per configuration read; the population
// is fixed when it loads.

import type { KnipConfig } from './harness/lib/knip-config.ts';
import { knipConfigOf } from './harness/lib/knip-config.ts';
import { population } from './harness/lib/scope.ts';

const config: KnipConfig = knipConfigOf(await population());

// Knip loads a config module's default export.
export default config;
