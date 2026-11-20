/**
 * The one owner of the unused-code scan: knip, run the way the `deadcode` task runs it (production
 * mode, then default mode, each treating a configuration hint as an error), and the ignore entries
 * of `knip.json`, each of which the harness holds to a reason. knip hints a stale
 * `ignoreDependencies`, `ignoreBinaries` or `ignoreWorkspaces` entry itself; a stale `ignoreIssues`
 * entry it does not, so `staleIgnoreIssues` proves each one covers an issue.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { json, object, repoTasks } from './config.ts';
import type { Finished } from './process.ts';
import { textOf } from './source-files.ts';
import { bin, finished } from './tools.ts';

/** The knip invocations of the `deadcode` task, as argument lists (without the binary). */
export function deadcodeRuns(): readonly (readonly string[])[] {
  const commands = repoTasks().get('deadcode')?.commands ?? [];
  return commands.filter((command) => command.startsWith('knip')).map((command) => command.split(' ').slice(1));
}

/** Run knip with `args` in `cwd`. */
export function knip(cwd: string, args: readonly string[]): Finished {
  return finished([bin('knip'), ...args, '--no-progress'], { cwd });
}

function strings(value: unknown, what: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${what} is not a list of strings`);
  }
  return value.filter((item) => typeof item === 'string');
}

/**
 * Every ignore entry of a parsed `knip.json`, as a key: `ignoreWorkspaces:<workspace>`,
 * `ignoreDependencies:<package>`, `ignoreBinaries:<binary>`, `ignoreFiles:<glob>` or
 * `ignoreIssues:<glob>:<issue type>`.
 */
export function ignoreEntries(config: unknown): readonly string[] {
  const fields = object(config, 'knip.json');
  const listed = ['ignoreWorkspaces', 'ignoreDependencies', 'ignoreBinaries', 'ignoreFiles'].flatMap((field) =>
    strings(fields[field] ?? [], field).map((entry) => `${field}:${entry}`),
  );
  const issues = Object.entries(object(fields.ignoreIssues ?? {}, 'ignoreIssues')).flatMap(([glob, types]) =>
    strings(types, `ignoreIssues.${glob}`).map((type) => `ignoreIssues:${glob}:${type}`),
  );
  return [...listed, ...issues];
}

/** The ignore entries of the repository's `knip.json`. */
export function repoIgnoreEntries(): readonly string[] {
  return ignoreEntries(json(textOf('knip.json')));
}

/**
 * The `ignoreIssues:<file>:<type>` keys of the issues knip reports under `config` with its
 * `ignoreIssues` removed, across every run of the deadcode task. The config is written outside the
 * checkout; knip resolves its paths from `cwd`.
 */
function issuesWithoutIgnores(cwd: string, config: unknown): ReadonlySet<string> {
  const { ignoreIssues: _dropped, ...rest } = object(config, 'knip.json');
  const directory = mkdtempSync(join(tmpdir(), 'knip-live-'));
  try {
    const path = join(directory, 'knip.json');
    writeFileSync(path, JSON.stringify(rest));
    const found = new Set<string>();
    for (const args of deadcodeRuns()) {
      const run = knip(cwd, [...args.filter((arg) => arg !== '--treat-config-hints-as-errors'), '-c', path, '--reporter', 'json']);
      for (const entry of reportedIssues(run.stdout)) {
        found.add(entry);
      }
    }
    return found;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The `ignoreIssues:<file>:<type>` keys of a knip JSON report: one per issue type a file has. */
function reportedIssues(report: string): readonly string[] {
  const issues = object(json(report), 'knip report').issues;
  if (!Array.isArray(issues)) {
    throw new Error('the knip report holds no issues list');
  }
  return issues.flatMap((issue: unknown) => {
    const fields = object(issue, 'knip issue');
    return Object.entries(fields)
      .filter(([type, value]) => type !== 'file' && Array.isArray(value) && value.length > 0)
      .map(([type]) => `ignoreIssues:${String(fields.file)}:${type}`);
  });
}

/** The `ignoreIssues` entries of `config` that cover no issue knip would report without them. */
export function staleIgnoreIssues(cwd: string, config: unknown): readonly string[] {
  const live = issuesWithoutIgnores(cwd, config);
  return ignoreEntries(config).filter((entry) => entry.startsWith('ignoreIssues:') && !live.has(entry));
}
