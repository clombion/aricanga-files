/** The renderers of the generated blocks, and the reading of check modules, over planted inputs. */

import { checkList, pinTable, taskTable } from '#lib/generated-render.ts';
import { describe, expect, test } from 'vitest';
import { ConfigError } from '#lib/config.ts';
import { checkModules } from '#lib/checks.ts';
import { run } from '#lib/generated.ts';

const DOC = "/**\n * Holds the planted rule.\n */\n\nconst HARNESS_ID = 'planted';\n";

describe('the check modules', () => {
  test('are the modules declaring an id, sorted by id then path, each with its doc line', () => {
    expect.hasAssertions();
    const modules = checkModules([
      ['b.test.ts', DOC],
      ['a.test.ts', DOC],
      ['c.test.ts', DOC.replace("'planted'", "'another'")],
      ['helper.ts', '/** No id here. */\n'],
    ]);
    expect(modules).toStrictEqual([
      { harnessId: 'another', path: 'c.test.ts', summary: 'Holds the planted rule.' },
      { harnessId: 'planted', path: 'a.test.ts', summary: 'Holds the planted rule.' },
      { harnessId: 'planted', path: 'b.test.ts', summary: 'Holds the planted rule.' },
    ]);
  });

  test('refuse a check module that opens with no doc comment, naming it', () => {
    expect.hasAssertions();
    expect(() => checkModules([['bare.test.ts', "const HARNESS_ID = 'bare';\n"]])).toThrow(
      new ConfigError('the check module bare.test.ts opens with no doc comment stating what it holds'),
    );
  });
});

describe('the renderers', () => {
  test('list each check with its path and doc line', () => {
    expect.hasAssertions();
    expect(checkList([{ harnessId: 'planted', path: 'a.test.ts', summary: 'Holds it.' }])).toBe('- `planted` (`a.test.ts`): Holds it.');
  });

  test('tabulate each pin with its upstream, and refuse a pin no upstream names', () => {
    expect.hasAssertions();
    const pin = { tool: 'planted', version: '1.0.0', where: 'package.json' };
    expect(pinTable([pin], new Map([['planted', 'owner/planted']]))).toBe(
      [
        '| Tool | Upstream | Pinned in | Pin |',
        '| --- | --- | --- | --- |',
        '| `planted` | [owner/planted](https://github.com/owner/planted) | `package.json` | 1.0.0 |',
      ].join('\n'),
    );
    expect(() => pinTable([pin], new Map())).toThrow(new ConfigError('no upstream repository is named for the pinned tool "planted"'));
  });

  test('tabulate the entry tasks and the tasks that lock first, escaping a pipe', () => {
    expect.hasAssertions();
    const tasks = [
      { commands: ['pnpm run lint'], name: 'check', script: 'pnpm run lint' },
      { commands: ['pnpm run lock:check', 'oxlint'], name: 'lint', script: 'pnpm run lock:check && oxlint | tee' },
      { commands: ['vite'], name: 'dev', script: 'vite' },
      { commands: [], name: 'empty', script: '' },
    ];
    expect(taskTable(tasks, new Set(['check']))).toBe(
      [
        '| Command | Runs |',
        '| --- | --- |',
        '| `pnpm run check` | `pnpm run lint` |',
        '| `pnpm run lint` | `pnpm run lock:check && oxlint \\| tee` |',
      ].join('\n'),
    );
  });
});

describe('the repository', () => {
  test('has every generated block current, run in-process', async () => {
    expect.hasAssertions();
    await expect(run(true)).resolves.toStrictEqual([]);
  });
});
