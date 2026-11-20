/**
 * The flake hunter fails a test that passes only in its usual order or only when nothing runs beside it.
 *
 * `test:stress` runs `harness/scripts/stress.ts`: several copies of the Vitest run at once, each
 * shuffling by its own seed, running each file's tests concurrently and repeating them. Planted in
 * a scratch Vitest project: an order-dependent spec and a timing-dependent spec each pass a plain
 * run and fail the hunt, and an independent spec passes both.
 */

import { describe, expect, test } from 'vitest';
import { hunt, huntOf } from '#lib/stress.ts';
import { EXIT_CLEAN } from './exit-status.ts';
import type { Hunt } from '#lib/stress.ts';
import { Project } from '#lib/tools.ts';

const HARNESS_ID = 'flake-hunter';

/** The hunt's options: its seed, copies and repeats. */
const SEED = 1;
const COPIES = 4;
const REPEATS = 2;
/** The planted options the parser reads back. */
const PLANTED_SEED = 7;
const PLANTED_COPIES = 2;
const PLANTED_REPEATS = 3;

const CONFIG = 'export default { test: { include: ["*.test.ts"], expect: { requireAssertions: true } } };\n';

const PLANTS: Readonly<Record<string, string>> = {
  'independent.test.ts': [
    "import { expect, test } from 'vitest';",
    'const later = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));',
    "test('a', async () => { const mine = ['a']; await later(); expect(mine).toStrictEqual(['a']); });",
    "test('b', async () => { const mine = ['b']; await later(); expect(mine).toStrictEqual(['b']); });",
    '',
  ].join('\n'),
  'order.test.ts': [
    "import { expect, test } from 'vitest';",
    'const seen: string[] = [];',
    "test('one', () => { seen.push('one'); expect(seen).toStrictEqual(['one']); });",
    "test('two', () => { seen.push('two'); expect(seen).toStrictEqual(['one', 'two']); });",
    "test('three', () => { seen.push('three'); expect(seen).toStrictEqual(['one', 'two', 'three']); });",
    '',
  ].join('\n'),
  'timing.test.ts': [
    "import { expect, test } from 'vitest';",
    "let current = '';",
    'const later = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));',
    "test('a', async () => { current = 'a'; await later(); expect(current).toBe('a'); });",
    "test('b', async () => { current = 'b'; await later(); expect(current).toBe('b'); });",
    '',
  ].join('\n'),
};

/**
 * A plain run and a hunt of one planted spec: their exit statuses.
 *
 * @param {string} file - The file.
 * @returns {Promise<readonly [number, readonly number[]]>} A plain run and a hunt of one planted spec: their exit statuses.
 */
async function plainAndHunted(file: string): Promise<readonly [number, readonly number[]]> {
  const project = new Project();
  try {
    project.write('vitest.config.ts', CONFIG);
    for (const [path, text] of Object.entries(PLANTS)) {
      project.write(path, text);
    }
    const plain = project.tool('vitest', 'run', '--root', project.root, '--config', 'vitest.config.ts', file);
    const options: Hunt = { config: 'vitest.config.ts', copies: COPIES, filters: [file], repeats: REPEATS, root: project.root, seed: SEED };
    const hunted = await hunt(options);
    return [plain.status, hunted.map((result) => result.status)];
  } finally {
    project.remove();
  }
}

describe('the flake hunter, on planted specs', () => {
  test('fails an order-dependent spec that a plain run passes', async () => {
    expect.hasAssertions();
    const [plain, hunted] = await plainAndHunted('order.test.ts');
    expect(plain).toBe(EXIT_CLEAN);
    expect(hunted.some((status) => status !== EXIT_CLEAN)).toBe(true);
  });

  test('fails a timing-dependent spec that a plain run passes', async () => {
    expect.hasAssertions();
    const [plain, hunted] = await plainAndHunted('timing.test.ts');
    expect(plain).toBe(EXIT_CLEAN);
    expect(hunted.some((status) => status !== EXIT_CLEAN)).toBe(true);
  });

  test('passes an independent spec in both', async () => {
    expect.hasAssertions();
    const cleanCopies = Array.from({ length: COPIES }, () => EXIT_CLEAN);
    await expect(plainAndHunted('independent.test.ts')).resolves.toStrictEqual([EXIT_CLEAN, cleanCopies]);
  });
});

describe('the hunt options', () => {
  test('read the seed, copies and repeats, keep the rest as filters, and give each copy its own seed', () => {
    expect.hasAssertions();
    const options = huntOf(['--seed', String(PLANTED_SEED), '--copies', String(PLANTED_COPIES), '--repeats', String(PLANTED_REPEATS), 'packages/foundation']);
    expect([options.seed, options.copies, options.repeats, options.filters]).toStrictEqual([PLANTED_SEED, PLANTED_COPIES, PLANTED_REPEATS, ['packages/foundation']]);
  });

  test.each([['--seed', '0'], ['--copies', 'x'], ['--repeats', '-1']])('refuses %s %s', (name, value) => {
    expect.hasAssertions();
    expect(() => huntOf([name, value])).toThrow(`${name} must be a positive integer`);
  });
});

export { HARNESS_ID };
