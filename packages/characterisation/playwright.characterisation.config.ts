import type { PlaywrightTestConfig } from '@playwright/test';
import { browserSuite } from './browsers';

// Step 1 of Phase 3: each claim about Solid's runtime, in every engine of the browser suite.
const config: PlaywrightTestConfig = browserSuite({ cwd: import.meta.dirname, port: 8100, report: true, testDir: './tests' });

export default config;
