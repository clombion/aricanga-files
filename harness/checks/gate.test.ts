/**
 * The gate writes no file, runs only locked tools, and the git hooks run the gate's own tasks.
 *
 * `pnpm run check` follows the `pnpm run <task>` commands of its tasks. No task in that closure may
 * write a file of the checkout: no fixer (`--fix`, `--write`, a formatter without `--check`), no
 * doc generation without `--check`, no snapshot update, no emitting `tsc`, no install but the
 * frozen lockfile check, no hook install, no git write and no shell redirection. Every task that
 * runs a tool starts with `lock:check`, and nothing runs an unlocked tool runner. The hooks:
 * pre-commit runs `pnpm run check:fast`, pre-push runs `pnpm run check` and the pushed-subjects
 * check, commit-msg runs commitlint, and no other hook or remote config is declared.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import type { Hook, Task } from '#lib/config.ts';
import { LOCK_CHECK, lockCheckAfter, lockCheckArguments } from './gate.lock.ts';
import { RUN, closure, hooks, repoHooks, repoTasks, tasks } from '#lib/config.ts';
import { describe, expect, test } from 'vitest';
import { Accepted } from '#lib/exemptions.ts';

const HARNESS_ID = 'gate';

const WRITERS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:oxlint|stylelint|knip)\b.*--fix/u, 'a fixer rewrites files'],
  [/\boxfmt\b(?!.*--check)/u, 'oxfmt without --check rewrites files'],
  [/\bbiome\b.*--(?:write|fix|unsafe)/u, 'biome --write rewrites files'],
  [/\bgen-docs\.ts\b(?!.*--check)/u, 'gen-docs without --check rewrites the docs'],
  [/\bvitest\b.*(?:\s-u\b|--update)/u, 'a snapshot update rewrites snapshots'],
  [/\btsc\b(?!.*--noEmit)/u, 'tsc without --noEmit writes its output'],
  [/\bpnpm (?:install|i|add|remove|rm|update|up)\b(?!.* --frozen-lockfile --lockfile-only$)/u, 'pnpm rewrites the lock or node_modules'],
  [/\blefthook install\b/u, 'installing hooks writes .git/hooks'],
  [/\bgit (?:add|commit|checkout|stash|reset|restore)\b/u, 'a git write'],
  [/(?<![0-9&])>{1,2}(?!&)/u, 'a redirection writes a file'],
];
const UNLOCKED_RUNNERS = /\b(?:npx|pnpx|pnpm dlx|bunx|yarn dlx|uvx)\b/u;
const GATE_TESTS = ['pnpm run test', 'pnpm run test:browser'];
/** A planted writer is one problem of its task. */
const ONE_PROBLEM = 1;
const HOOK_TYPES = new Accepted(['pre-commit', 'pre-push', 'commit-msg']);

/**
 * What breaks the gate's rules in one task: a command that writes, or a tool run without the lock check first.
 *
 * @param {Task} task - A task `check` runs.
 * @returns {readonly string[]} The task's problems.
 */
function taskProblems(task: Task): readonly string[] {
  const problems: string[] = [];
  for (const command of task.commands) {
    for (const [pattern, why] of WRITERS) {
      if (pattern.test(command)) {
        problems.push(`${task.name}: ${why}: ${command}`);
      }
    }
  }
  const [first] = task.commands;
  const runsATool = task.commands.some((command) => !RUN.test(command));
  if (runsATool && task.name !== LOCK_CHECK && first !== `pnpm run ${LOCK_CHECK}`) {
    problems.push(`${task.name}: runs a tool but does not start with ${LOCK_CHECK}`);
  }
  return problems;
}

/**
 * Whether the gate is `check:fast` plus the tests, and `check:fast` runs no test.
 *
 * @param {ReadonlyMap<string, Task>} every - Every task of the root `package.json`, by name.
 * @returns {readonly string[]} The gate's shape problems.
 */
function shapeProblems(every: ReadonlyMap<string, Task>): readonly string[] {
  const fastRunsTests = closure('check:fast', every).some((task) => task.name.startsWith('test'));
  const check = every.get('check')?.commands ?? [];
  const [first] = check;
  const shaped = first === 'pnpm run check:fast' && GATE_TESTS.every((command) => check.includes(command));
  return [...(fastRunsTests ? ['check:fast runs the tests'] : []), ...(shaped ? [] : ['check is not check:fast plus the tests'])];
}

/**
 * What breaks the gate's rules among the tasks `check` runs.
 *
 * @param {ReadonlyMap<string, Task>} every - Every task of the root `package.json`, by name.
 * @returns {readonly string[]} What breaks the gate's rules among the tasks `check` runs.
 */
function gateProblems(every: ReadonlyMap<string, Task>): readonly string[] {
  return [...closure('check', every).flatMap((task) => taskProblems(task)), ...shapeProblems(every)];
}

/**
 * The commands that run an unlocked tool runner.
 *
 * @param {readonly string[]} commands - The commands.
 * @returns {readonly string[]} The commands that run an unlocked tool runner.
 */
function runnerProblems(commands: readonly string[]): readonly string[] {
  return commands.filter((command) => UNLOCKED_RUNNERS.test(command)).map((command) => `unlocked runner: ${command}`);
}

/**
 * What breaks the hook rules.
 *
 * @param {readonly Hook[]} declared - The hooks `lefthook.json` declares.
 * @returns {readonly string[]} What breaks the hook rules.
 */
function hookProblems(declared: readonly Hook[]): readonly string[] {
  const problems = declared
    .filter((hook) => !HOOK_TYPES.has(hook.hook))
    .map((hook) => `${hook.hook}.${hook.id}: not an expected hook type`);
  const runs = (hook: string): string[] =>
    declared
      .filter((candidate) => candidate.hook === hook)
      .map((candidate) => candidate.run)
      .toSorted();
  const expected: readonly (readonly [string, readonly string[]])[] = [
    ['pre-commit', ['pnpm run check:fast']],
    ['pre-push', ['node harness/scripts/check-pushed.ts', 'pnpm run check']],
    ['commit-msg', ['pnpm exec commitlint --edit {1}']],
  ];
  for (const [hook, wanted] of expected) {
    if (JSON.stringify(runs(hook)) !== JSON.stringify(wanted)) {
      problems.push(`${hook} runs ${JSON.stringify(runs(hook))}, not ${JSON.stringify(wanted)}`);
    }
  }
  if (!declared.some((hook) => hook.hook === 'pre-push' && hook.id === 'pushed-subjects' && hook.useStdin)) {
    problems.push('pre-push pushed-subjects does not read the pushed refs on its standard input');
  }
  return problems;
}

/**
 * A planted gate whose one tool task runs `command`.
 *
 * @param {string} command - The planted task's command.
 * @returns {ReadonlyMap<string, Task>} The planted tasks, by name.
 */
function planted(command: string): ReadonlyMap<string, Task> {
  return tasks({
    scripts: {
      check: 'pnpm run check:fast && pnpm run test && pnpm run test:browser',
      'check:fast': 'pnpm run lock:check && pnpm run planted',
      'lock:check': 'pnpm install --frozen-lockfile --lockfile-only',
      planted: `pnpm run lock:check && ${command}`,
      test: 'pnpm run lock:check && vitest run',
      'test:browser': 'pnpm run lock:check && playwright test',
    },
  });
}

/**
 * The scripts tasks were read from, by name.
 *
 * @param {ReadonlyMap<string, Task>} read - Tasks, by name.
 * @returns {Readonly<Record<string, string>>} Each task's script.
 */
function scriptsOf(read: ReadonlyMap<string, Task>): Readonly<Record<string, string>> {
  return Object.fromEntries([...read.values()].map((task) => [task.name, task.script]));
}

describe('the repository', () => {
  test('the gate writes nothing and runs locked tools', () => {
    expect.hasAssertions();
    expect(gateProblems(repoTasks())).toStrictEqual([]);
  });

  test('no task or hook runs an unlocked tool', () => {
    expect.hasAssertions();
    const commands = [...repoTasks().values()].flatMap((task) => task.commands);
    expect(runnerProblems([...commands, ...repoHooks().map((hook) => hook.run)])).toStrictEqual([]);
  });

  test('the hooks run the gate', () => {
    expect.hasAssertions();
    expect(hookProblems(repoHooks())).toStrictEqual([]);
  });
});

describe('the gate check', () => {
  test.each([
    'oxlint --fix',
    'oxfmt',
    'oxfmt .',
    'biome check --write',
    'stylelint "**/*.css" --fix',
    'knip --fix',
    'node harness/scripts/gen-docs.ts',
    'vitest run -u',
    'vitest run --update',
    'tsc -b',
    'tsc -p harness',
    'pnpm install',
    'pnpm install --frozen-lockfile',
    'pnpm add -D x',
    'lefthook install',
    'git add .',
    'vitest run > report.txt',
  ])('sees the planted writer %s', (command) => {
    expect.hasAssertions();
    expect(gateProblems(planted(command))).toHaveLength(ONE_PROBLEM);
  });

});

describe('the gate check, followed into tasks', () => {
  test('follows pnpm run into a nested task, and lets a reader through', () => {
    expect.hasAssertions();
    const nested = tasks({
      scripts: {
        ...scriptsOf(planted('pnpm run deep')),
        deep: 'pnpm run lock:check && oxfmt',
      },
    });
    expect(gateProblems(nested)).toStrictEqual(['deep: oxfmt without --check rewrites files: oxfmt']);
    expect(gateProblems(planted('oxfmt --check 2>&1'))).toStrictEqual([]);
    expect(gateProblems(planted('tsc --noEmit -p harness'))).toStrictEqual([]);
  });

  test('sees a tool task without the lock check, and a gate of the wrong shape', () => {
    expect.hasAssertions();
    const unlocked = tasks({
      scripts: {
        ...scriptsOf(planted('oxlint')),
        planted: 'oxlint',
      },
    });
    expect(gateProblems(unlocked)).toStrictEqual(['planted: runs a tool but does not start with lock:check']);
    const shape = tasks({
      scripts: {
        check: 'pnpm run check:fast',
        'check:fast': 'pnpm run lock:check && pnpm run test',
        'lock:check': 'pnpm install --frozen-lockfile --lockfile-only',
        test: 'pnpm run lock:check && vitest run',
      },
    });
    expect(gateProblems(shape)).toStrictEqual(['check:fast runs the tests', 'check is not check:fast plus the tests']);
  });

  test.each(['npx jscpd', 'pnpm dlx knip', 'pnpx oxlint', 'bunx x', 'yarn dlx x', 'uvx ruff'])(
    'sees the unlocked runner %s',
    (command) => {
      expect.hasAssertions();
      expect(runnerProblems([command, 'oxlint'])).toStrictEqual([`unlocked runner: ${command}`]);
    },
  );
});

describe('the hook check', () => {
  test('sees each planted hook', () => {
    expect.hasAssertions();
    const plantedHooks = hooks({
      'post-merge': { commands: { late: { run: 'pnpm run check' } } },
      'pre-commit': { commands: { lint: { run: 'oxlint' } } },
      'pre-push': { commands: { 'pushed-subjects': { run: 'node harness/scripts/check-pushed.ts' } } },
    });
    expect(hookProblems(plantedHooks)).toStrictEqual([
      'post-merge.late: not an expected hook type',
      'pre-commit runs ["oxlint"], not ["pnpm run check:fast"]',
      'pre-push runs ["node harness/scripts/check-pushed.ts"], not ["node harness/scripts/check-pushed.ts","pnpm run check"]',
      'commit-msg runs [], not ["pnpm exec commitlint --edit {1}"]',
      'pre-push pushed-subjects does not read the pushed refs on its standard input',
    ]);
  });
});

describe('the lock check', () => {
  test('is the frozen, lockfile-only install', () => {
    expect.hasAssertions();
    expect(lockCheckArguments()).toStrictEqual(['pnpm', 'install', '--frozen-lockfile', '--lockfile-only']);
  });

  test('passes a lockfile current with package.json', () => {
    expect.hasAssertions();
    expect(lockCheckAfter('1.9.1', '1.9.1')).toStrictEqual({ outdated: false, status: EXIT_CLEAN });
  });

  test('refuses a lockfile older than package.json', () => {
    expect.hasAssertions();
    expect(lockCheckAfter('1.9.1', '1.9.0')).toStrictEqual({ outdated: true, status: EXIT_FINDINGS });
  });
});

export { HARNESS_ID };
