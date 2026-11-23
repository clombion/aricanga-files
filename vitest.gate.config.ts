// The gate's test run: the config of `harness/lib/vitest-config.ts` over the repository's population.
// The population and the listing are fixed when the config loads, and every worker reads the ones it
// provides (`harness/lib/provided.ts`): so are the globs, and every check's view of the held files. A
// watching run sees a new member, a new file or a renamed one once restarted.

import type { ViteUserConfig } from 'vitest/config';
import { configOf } from './harness/lib/vitest-config.ts';
import { population } from './harness/lib/scope.ts';
import solid from '@solidjs/vite-plugin';

// The sandbox's parts are Solid JSX, compiled by Solid's own plugin.
const config: ViteUserConfig = configOf(await population(), () => [solid()]);

// Vitest loads a config module's default export.
export default config;
