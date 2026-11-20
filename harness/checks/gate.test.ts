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

import { describe, expect, test } from 'vitest';

import { closure, type Hook, hooks, repoHooks, repoTasks, RUN, type Task, tasks } from '../lib/config.ts';
import { Accepted } from '../lib/exemptions.ts';
import { Project } from '../lib/tools.ts';

export const HARNESS_ID = 'gate';

const WRITERS: readonly (readonly [RegExp, string])[] = [
  [/\b(oxlint|stylelint|knip)\b.*--fix/, 'a fixer rewrites files'],
  [/\boxfmt\b(?!.*--check)/, 'oxfmt without --check rewrites files'],
  [/\bbiome\b.*--(write|fix|unsafe)/, 'biome --write rewrites files'],
  [/\bgen-docs\.ts\b(?!.*--check)/, 'gen-docs without --check rewrites the docs'],
  [/\bvitest\b.*(\s-u\b|--update)/, 'a snapshot update rewrites snapshots'],
  [/\btsc\b(?!.*--noEmit)/, 'tsc without --noEmit writes its output'],
  [/\bpnpm (install|i|add|remove|rm|update|up)\b(?!.* --frozen-lockfile --lockfile-only$)/, 'pnpm rewrites the lock or node_modules'],
  [/\blefthook install\b/, 'installing hooks writes .git/hooks'],
  [/\bgit (add|commit|checkout|stash|reset|restore)\b/, 'a git write'],
  [/(?<![0-9&])>{1,2}(?!&)/, 'a redirection writes a file'],
];
const UNLOCKED_RUNNERS = /\b(npx|pnpx|pnpm dlx|bunx|yarn dlx|uvx)\b/;
const LOCK_CHECK = 'lock:check';
const GATE_TESTS = ['pnpm run test', 'pnpm run test:browser'];
const HOOK_TYPES = new Accepted(['pre-commit', 'pre-push', 'commit-msg']);

/** What breaks the gate's rules among the tasks `check` runs. */
export function gateProblems(every: ReadonlyMap<string, Task>): readonly string[] {
  const problems: string[] = [];
  for (const task of closure('check', every)) {
    for (const command of task.commands) {
      for (const [pattern, why] of WRITERS) {
        if (pattern.test(command)) {
          problems.push(`${task.name}: ${why}: ${command}`);
        }
      }
    }
    const runsATool = task.commands.some((command) => !RUN.test(command));
    if (runsATool && task.name !== LOCK_CHECK && task.commands[0] !== `pnpm run ${LOCK_CHECK}`) {
      problems.push(`${task.name}: runs a tool but does not start with ${LOCK_CHECK}`);
    }
  }
  if (closure('check:fast', every).some((task) => task.name.startsWith('test'))) {
    problems.push('check:fast runs the tests');
  }
  const check = every.get('check')?.commands ?? [];
  if (check[0] !== 'pnpm run check:fast' || GATE_TESTS.some((command) => !check.includes(command))) {
    problems.push('check is not check:fast plus the tests');
  }
  return problems;
}

/** The commands that run an unlocked tool runner. */
export function runnerProblems(commands: readonly string[]): readonly string[] {
  return commands.filter((command) => UNLOCKED_RUNNERS.test(command)).map((command) => `unlocked runner: ${command}`);
}

/** What breaks the hook rules. */
export function hookProblems(declared: readonly Hook[]): readonly string[] {
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

describe('the repository', () => {
  test('the gate writes nothing and runs locked tools', () => {
    expect(gateProblems(repoTasks())).toEqual([]);
  });

  test('no task or hook runs an unlocked tool', () => {
    const commands = [...repoTasks().values()].flatMap((task) => task.commands);
    expect(runnerProblems([...commands, ...repoHooks().map((hook) => hook.run)])).toEqual([]);
  });

  test('the hooks run the gate', () => {
    expect(hookProblems(repoHooks())).toEqual([]);
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
    expect(gateProblems(planted(command))).toHaveLength(1);
  });

  test('follows pnpm run into a nested task, and lets a reader through', () => {
    const nested = tasks({
      scripts: {
        ...Object.fromEntries([...planted('pnpm run deep')].map(([name, task]) => [name, task.script])),
        deep: 'pnpm run lock:check && oxfmt',
      },
    });
    expect(gateProblems(nested)).toEqual(['deep: oxfmt without --check rewrites files: oxfmt']);
    expect(gateProblems(planted('oxfmt --check 2>&1'))).toEqual([]);
    expect(gateProblems(planted('tsc --noEmit -p harness'))).toEqual([]);
  });

  test('sees a tool task without the lock check, and a gate of the wrong shape', () => {
    const unlocked = tasks({
      scripts: {
        ...Object.fromEntries([...planted('oxlint')].map(([name, task]) => [name, task.script])),
        planted: 'oxlint',
      },
    });
    expect(gateProblems(unlocked)).toEqual(['planted: runs a tool but does not start with lock:check']);
    const shape = tasks({
      scripts: {
        check: 'pnpm run check:fast',
        'check:fast': 'pnpm run lock:check && pnpm run test',
        'lock:check': 'pnpm install --frozen-lockfile --lockfile-only',
        test: 'pnpm run lock:check && vitest run',
      },
    });
    expect(gateProblems(shape)).toEqual(['check:fast runs the tests', 'check is not check:fast plus the tests']);
  });

  test.each(['npx jscpd', 'pnpm dlx knip', 'pnpx oxlint', 'bunx x', 'yarn dlx x', 'uvx ruff'])(
    'sees the unlocked runner %s',
    (command) => {
      expect(runnerProblems([command, 'oxlint'])).toEqual([`unlocked runner: ${command}`]);
    },
  );
});

describe('the hook check', () => {
  test('sees each planted hook', () => {
    const plantedHooks = hooks({
      'pre-commit': { commands: { lint: { run: 'oxlint' } } },
      'post-merge': { commands: { late: { run: 'pnpm run check' } } },
      'pre-push': { commands: { 'pushed-subjects': { run: 'node harness/scripts/check-pushed.ts' } } },
    });
    expect(hookProblems(plantedHooks)).toEqual([
      'post-merge.late: not an expected hook type',
      'pre-commit runs ["oxlint"], not ["pnpm run check:fast"]',
      'pre-push runs ["node harness/scripts/check-pushed.ts"], not ["node harness/scripts/check-pushed.ts","pnpm run check"]',
      'commit-msg runs [], not ["pnpm exec commitlint --edit {1}"]',
      'pre-push pushed-subjects does not read the pushed refs on its standard input',
    ]);
  });
});

/** A planted manifest pinning one dependency at `version`. */
function manifest(version: string): string {
  return JSON.stringify({ name: 'plant', version: '0.0.0', private: true, devDependencies: { 'smol-toml': version } });
}

describe('the lock check', () => {
  test('refuses a lockfile older than package.json', () => {
    const lockCheck = repoTasks().get(LOCK_CHECK)?.commands[0]?.split(' ') ?? [];
    expect(lockCheck).toEqual(['pnpm', 'install', '--frozen-lockfile', '--lockfile-only']);
    const project = new Project({ linkModules: false });
    try {
      project.write('package.json', manifest('1.9.1'));
      expect(project.run('pnpm', 'install', '--lockfile-only', '--ignore-scripts').status).toBe(0);
      expect(project.run(...lockCheck).status).toBe(0);
      project.write('package.json', manifest('1.9.0'));
      const stale = project.run(...lockCheck);
      expect([stale.status, stale.stdout.includes('ERR_PNPM_OUTDATED_LOCKFILE')]).toEqual([1, true]);
    } finally {
      project.remove();
    }
  });
});
