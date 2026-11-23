import type { PlaywrightTestConfig } from '@playwright/test';
import { browserSuite } from '@narratives/characterisation/browsers';

// The sandbox's parts, in every engine of the browser suite, served by the sandbox's dev server.
const config: PlaywrightTestConfig = browserSuite({ cwd: import.meta.dirname, port: 8101, report: false, testDir: './test' });

export default config;
