/**
 * Every generated block of the docs equals a fresh render, names a known generator, and every generator has a block.
 *
 * The blocks and generators are `harness/lib/generated.ts`'s; the gate's `docs:check` task runs
 * `harness/scripts/gen-docs.ts --check`, which this check runs as the gate does.
 */

import { BlockError, Doc } from '#lib/docs.ts';
import type { Files, Generators } from '#lib/generated.ts';
import { GENERATORS, blocks, problems, rendered, run } from '#lib/generated.ts';
import { describe, expect, test } from 'vitest';
import { EXIT_CLEAN } from './exit-status.ts';
import { REPO_ROOT } from '#lib/paths.ts';
import { finished } from '#lib/tools.ts';

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
    paths: () => [...texts.keys()],
    read: (path) => new Doc(path, texts.get(path) ?? ''),
    write: (path, text) => {
      texts.set(path, text);
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
  test('every block is current and named by a generator, as the gate runs it', () => {
    expect.hasAssertions();
    const done = finished(['node', 'harness/scripts/gen-docs.ts', '--check'], { cwd: REPO_ROOT });
    expect({ status: done.status, stderr: done.stderr }).toStrictEqual({ status: EXIT_CLEAN, stderr: '' });
  });

  test('every generator has a block', () => {
    expect.hasAssertions();
    expect(orphans(GENERATORS, blocks().map((block) => block.name))).toStrictEqual([]);
  });
});

describe('the generated-docs check', () => {
  test('sees a hand-edited block as stale, and rendering restores it', () => {
    expect.hasAssertions();
    const doc = new Doc('docs/planted.md', PLANTED);
    expect(problems(doc, GENERATORS)).toStrictEqual([
      { line: 3, message: 'block "tasks" is stale: run `pnpm run fix`', path: 'docs/planted.md', writingFixesIt: true },
    ]);
    const restored = new Doc('docs/planted.md', rendered(doc, GENERATORS));
    expect(problems(restored, GENERATORS)).toStrictEqual([]);
  });

  test('refuses an unknown block name and leaves it as it is', () => {
    expect.hasAssertions();
    const doc = new Doc('docs/planted.md', PLANTED.replaceAll('tasks', 'planted'));
    expect(problems(doc, GENERATORS)).toStrictEqual([
      { line: 3, message: 'no generator is named "planted"', path: 'docs/planted.md', writingFixesIt: false },
    ]);
    expect(rendered(doc, GENERATORS)).toBe(doc.text);
  });

  test('sees a generator with no block', () => {
    expect.hasAssertions();
    const planted = new Map([...GENERATORS, ['planted', (): string => 'x']]);
    expect(orphans(planted, blocks().map((block) => block.name))).toStrictEqual(['planted']);
  });

  test.each([
    '<!-- generated: a -->\n',
    '<!-- end: a -->\n',
    '<!-- generated: a -->\n<!-- end: b -->\n',
    '<!-- generated: a -->\n<!-- generated: b -->\n',
  ])('refuses the unpaired marker in %j', (text) => {
    expect.hasAssertions();
    expect(() => new Doc('docs/planted.md', text).blocks()).toThrow(BlockError);
  });

});

describe('the generated-docs run', () => {
  test('checking finds both blocks and writes nothing', () => {
    expect.hasAssertions();
    const { files, texts } = plantedFiles();
    expect(run(true, GENERATORS, files).map((problem) => problem.path).toSorted()).toStrictEqual(['stale.md', 'unknown.md']);
    expect(texts.get('stale.md')).toBe(PLANTED);
  });

  test('writing fixes the stale block, leaves the unknown one, and checking then finds the unknown one only', () => {
    expect.hasAssertions();
    const { files, texts } = plantedFiles();
    expect(run(false, GENERATORS, files).map((problem) => problem.path)).toStrictEqual(['unknown.md']);
    expect(texts.get('stale.md')).not.toContain('hand-edited');
    expect(texts.get('unknown.md')).toBe(PLANTED.replaceAll('tasks', 'planted'));
    expect(run(true, GENERATORS, files).map((problem) => problem.path)).toStrictEqual(['unknown.md']);
  });
});

export { HARNESS_ID, orphans };
