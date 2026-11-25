/**
 * The gate builds every held Vite app in check mode, and a build that fails or writes into the checkout fails.
 *
 * `build:check` runs `harness/scripts/build-check.ts`: each app is built with Node's own config
 * loader into a temporary directory while the checkout's untracked and ignored files are watched.
 * Planted in a scratch repository: a broken import fails, a clean module passes, and a config whose
 * plugin writes a file into its app fails while one that writes nowhere passes.
 */

import { apps, checkBuild } from '#lib/build.ts';
import { describe, expect, test } from 'vitest';
import { EXIT_CLEAN } from '#lib/exit-status.ts';
import { Project } from '#lib/tools.ts';
import { importerOf } from '#lib/package-dirs.ts';
import { inSequence } from '#lib/lists.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'build-check';

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

async function plantedBuild(main: string, config: string): ReturnType<typeof checkBuild> {
  const project = await Project.create();
  try {
    await project.run('git', 'init', '-q');
    await project.writeAll([
      ['.gitignore', 'node_modules\n'],
      ['app/index.html', INDEX],
      ['app/main.ts', main],
      ['app/vite.config.ts', config],
    ]);
    const result = await checkBuild('app', project.root);
    return result;
  } finally {
    await project.remove();
  }
}

describe('the repository', () => {
  test('builds every held app and writes nothing into the checkout', async () => {
    expect.hasAssertions();
    const [found, held] = await Promise.all([apps(), population()]);
    const memberApps = held.members
      .filter((member) => held.listing.includes(`${member.dir}vite.config.ts`))
      .map((member) => importerOf(member.dir));
    expect(memberApps).not.toStrictEqual([]);
    expect(found).toStrictEqual(expect.arrayContaining(memberApps));
    const results = await inSequence(found, async (app) => {
      const result = await checkBuild(app);
      return result;
    });
    expect(results.filter((result) => result.status !== EXIT_CLEAN).map((result) => result.output)).toStrictEqual([]);
    expect(results.flatMap((result) => result.written)).toStrictEqual([]);
  });
});

describe('the build check', () => {
  test('fails a planted broken import', async () => {
    expect.hasAssertions();
    const result = await plantedBuild("import { gone } from './missing';\nexport const x = gone;\n", QUIET_CONFIG);
    expect(result.status).not.toBe(EXIT_CLEAN);
  });

  test('passes a planted clean module', async () => {
    expect.hasAssertions();
    const result = await plantedBuild('export const x = 1;\n', QUIET_CONFIG);
    expect([result.status, result.written]).toStrictEqual([EXIT_CLEAN, []]);
  });

  test('sees a build that writes into its checkout', async () => {
    expect.hasAssertions();
    const result = await plantedBuild('export const x = 1;\n', WRITING_CONFIG);
    expect([result.status, result.written]).toStrictEqual([EXIT_CLEAN, ['app/made.json']]);
  });
});

export { HARNESS_ID };
