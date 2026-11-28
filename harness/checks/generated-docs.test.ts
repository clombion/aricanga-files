/**
 * Every generated block of the docs equals a fresh render, names a known generator, and every generator has a block.
 *
 * The blocks and generators are `harness/lib/generated.ts`'s; the gate's `docs:check` task runs
 * `harness/scripts/gen-docs.ts --check`, which this check runs as the gate does, and again under a
 * locale whose collation orders letters otherwise (Lithuanian): every block is ordered by code unit.
 */

import { BlockError, Doc } from '#lib/docs.ts';
import type { Files, Generators } from '#lib/generated.ts';
import { GENERATORS, blocks, problems, rendered, run } from '#lib/generated.ts';
import { describe, test } from 'vitest';
import { finished, isolatedEnv } from '#lib/tools.ts';
import { EXIT_SUCCESS } from '#lib/output.ts';
import { REPO_ROOT } from '#lib/paths.ts';

const HARNESS_ID = 'generated-docs';

const PLANTED = '# Planted\n\n<!-- generated: tasks -->\nhand-edited\n<!-- end: tasks -->\n';

/**
 * A docs tree held in memory: a stale block and an unknown one, which writing changes in place.
 *
 * @returns {{ files: Files; texts: Map<string, string> }} The files the generators read and write, and their texts.
 */
function plantedFiles(): { readonly files: Files; readonly texts: Map<string, string> } {
  const texts = new Map([
    ['stale.md', PLANTED],
    ['unknown.md', PLANTED.replaceAll('tasks', 'planted')],
  ]);
  const files: Files = {
    paths: async () => {
      const paths = await Promise.resolve([...texts.keys()]);
      return paths;
    },
    read: async (path) => {
      const text = await Promise.resolve(texts.get(path) ?? '');
      return new Doc(path, text);
    },
    write: async (path, text) => {
      await Promise.resolve(texts.set(path, text));
    },
  };
  return { files, texts };
}

/**
 * The generators no block of the docs names.
 *
 * @param {Generators} generators - The generators.
 * @param {readonly string[]} names - The names.
 * @returns {string[]} The generators no block of the docs names.
 */
function orphans(generators: Generators, names: readonly string[]): string[] {
  return [...generators.keys()].filter((name) => !names.includes(name)).toSorted();
}

describe('the repository', () => {
  test('every block is current and named by a generator, as the gate runs it', async ({ expect }) => {
    expect.hasAssertions();
    const done = await finished(['node', 'harness/scripts/gen-docs.ts', '--check'], { cwd: REPO_ROOT });
    expect({ status: done.status, stderr: done.stderr }).toStrictEqual({ status: EXIT_SUCCESS, stderr: '' });
  });

  test('every block is current under a locale that orders letters otherwise', async ({ expect }) => {
    expect.hasAssertions();
    const env = isolatedEnv({ LANG: 'lt_LT.UTF-8', LC_ALL: 'lt_LT.UTF-8' });
    const done = await finished(['node', 'harness/scripts/gen-docs.ts', '--check'], { cwd: REPO_ROOT, env });
    expect({ status: done.status, stderr: done.stderr }).toStrictEqual({ status: EXIT_SUCCESS, stderr: '' });
  });

  test('every generator has a block', async ({ expect }) => {
    expect.hasAssertions();
    const found = await blocks();
    expect(
      orphans(
        GENERATORS,
        found.map((block) => block.name),
      ),
    ).toStrictEqual([]);
  });
});

/**
 * The repository's generators plus one, `planted`, that no doc has a block for.
 *
 * @returns {typeof GENERATORS} The generators with the orphan added.
 */
function withOrphan(): typeof GENERATORS {
  return new Map([
    ...GENERATORS,
    [
      'planted',
      async (): Promise<string> => {
        const text = await Promise.resolve('x');
        return text;
      },
    ],
  ]);
}

describe('the generated-docs check', () => {
  test('sees a hand-edited block as stale, and rendering restores it', async ({ expect }) => {
    expect.hasAssertions();
    const doc = new Doc('docs/planted.md', PLANTED);
    await expect(problems(doc, GENERATORS)).resolves.toStrictEqual([
      { line: 3, message: 'block "tasks" is stale: run `pnpm run fix`', path: 'docs/planted.md', writingFixesIt: true },
    ]);
    const restored = new Doc('docs/planted.md', await rendered(doc, GENERATORS));
    await expect(problems(restored, GENERATORS)).resolves.toStrictEqual([]);
  });

  test('refuses an unknown block name and leaves it as it is', async ({ expect }) => {
    expect.hasAssertions();
    const doc = new Doc('docs/planted.md', PLANTED.replaceAll('tasks', 'planted'));
    await expect(problems(doc, GENERATORS)).resolves.toStrictEqual([
      { line: 3, message: 'no generator is named "planted"', path: 'docs/planted.md', writingFixesIt: false },
    ]);
    await expect(rendered(doc, GENERATORS)).resolves.toBe(doc.text);
  });

  test('sees a generator with no block', async ({ expect }) => {
    expect.hasAssertions();
    const found = await blocks();
    expect(
      orphans(
        withOrphan(),
        found.map((block) => block.name),
      ),
    ).toStrictEqual(['planted']);
  });

  test.for([
    '<!-- generated: a -->\n',
    '<!-- end: a -->\n',
    '<!-- generated: a -->\n<!-- end: b -->\n',
    '<!-- generated: a -->\n<!-- generated: b -->\n',
  ])('refuses the unpaired marker in %j', (text, { expect }) => {
    expect.hasAssertions();
    expect(() => new Doc('docs/planted.md', text).blocks()).toThrow(BlockError);
  });
});

describe('the generated-docs run', () => {
  test('checking finds both blocks and writes nothing', async ({ expect }) => {
    expect.hasAssertions();
    const { files, texts } = plantedFiles();
    const left = await run(true, GENERATORS, files);
    expect(left.map((problem) => problem.path).toSorted()).toStrictEqual(['stale.md', 'unknown.md']);
    expect(texts.get('stale.md')).toBe(PLANTED);
  });

  test('writing fixes the stale block, leaves the unknown one, and checking then finds the unknown one only', async ({ expect }) => {
    expect.hasAssertions();
    const { files, texts } = plantedFiles();
    const written = await run(false, GENERATORS, files);
    expect(written.map((problem) => problem.path)).toStrictEqual(['unknown.md']);
    expect(texts.get('stale.md')).not.toContain('hand-edited');
    expect(texts.get('unknown.md')).toBe(PLANTED.replaceAll('tasks', 'planted'));
    const checked = await run(true, GENERATORS, files);
    expect(checked.map((problem) => problem.path)).toStrictEqual(['unknown.md']);
  });
});

export { HARNESS_ID, orphans };
