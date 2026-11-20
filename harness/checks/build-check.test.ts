/**
 * The gate builds every held Vite app in check mode, and a build that fails or writes into the checkout fails.
 *
 * `build:check` runs `harness/scripts/build-check.ts`: each app is built with Node's own config
 * loader into a temporary directory while the checkout's untracked and ignored files are watched.
 * Planted in a scratch repository: a broken import fails, a clean module passes, and a config whose
 * plugin writes a file into its app fails while one that writes nowhere passes.
 */

import { describe, expect, test } from 'vitest';

import { apps, checkBuild } from '../lib/build.ts';
import { Project } from '../lib/tools.ts';

export const HARNESS_ID = 'build-check';

const INDEX = '<!doctype html><html><body><script type="module" src="./main.ts"></script></body></html>\n';
const QUIET_CONFIG = 'export default { logLevel: "silent" };\n';
const WRITING_CONFIG = [
  "import { writeFileSync } from 'node:fs';",
  "import { join } from 'node:path';",
  'export default {',
  '  plugins: [{ name: "plant", buildStart() { writeFileSync(join(import.meta.dirname, "made.json"), "{}"); } }],',
  '};',
  '',
].join('\n');

function plantedBuild(main: string, config: string): ReturnType<typeof checkBuild> {
  const project = new Project();
  try {
    project.run('git', 'init', '-q');
    project.write('.gitignore', 'node_modules\n');
    project.write('app/index.html', INDEX);
    project.write('app/main.ts', main);
    project.write('app/vite.config.ts', config);
    return checkBuild('app', project.root);
  } finally {
    project.remove();
  }
}

describe('the repository', () => {
  test('builds every held app and writes nothing into the checkout', () => {
    expect(apps()).toEqual(['experiences/sandbox', 'packages/characterisation']);
    const results = apps().map((app) => checkBuild(app));
    expect(results.filter((result) => result.status !== 0).map((result) => result.output)).toEqual([]);
    expect(results.flatMap((result) => result.written)).toEqual([]);
  });
});

describe('the build check', () => {
  test('fails a planted broken import', () => {
    const result = plantedBuild("import { gone } from './missing';\nexport const x = gone;\n", QUIET_CONFIG);
    expect(result.status).not.toBe(0);
  });

  test('passes a planted clean module', () => {
    const result = plantedBuild('export const x = 1;\n', QUIET_CONFIG);
    expect([result.status, result.written]).toEqual([0, []]);
  });

  test('sees a build that writes into its checkout', () => {
    const result = plantedBuild('export const x = 1;\n', WRITING_CONFIG);
    expect([result.status, result.written]).toEqual([0, ['app/made.json']]);
  });
});
