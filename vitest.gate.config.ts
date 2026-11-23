// The gate's test run: the config of `harness/lib/vitest-config.ts` over the repository's population.
// The globs are fixed when the config loads, so a watching run reads a new member's first test once
// restarted.

import type { ViteUserConfig } from 'vitest/config';
import { configOf } from './harness/lib/vitest-config.ts';
import { population } from './harness/lib/scope.ts';
import solid from '@solidjs/vite-plugin';

// The sandbox's parts are Solid JSX, compiled by Solid's own plugin.
const config: ViteUserConfig = configOf(await population(), () => [solid()]);

// Vitest loads a config module's default export.
export default config;
