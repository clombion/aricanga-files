/**
 * The one owner of building the product from the gate: every held Vite app is built in `check`
 * mode into a temporary directory, and a build that writes into the checkout is a finding.
 */

import { bin, finished } from './tools.ts';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import type { Finished } from './process.ts';
import { REPO_ROOT } from './paths.ts';
import { createHash } from 'node:crypto';
import { heldFiles } from './scope.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

/** One app's build: whether it succeeded, its output, and what it wrote into the checkout. */
interface BuildResult {
  readonly app: string;
  readonly status: number;
  readonly output: string;
  readonly written: readonly string[];
}

/** The width of a `git status --porcelain=v1` entry's status columns and their separator. */
const STATUS_WIDTH = 3;

/**
 * The held Vite apps: every held directory with a `vite.config.ts`.
 *
 * @returns {readonly string[]} The apps' directories.
 */
function apps(): readonly string[] {
  return heldFiles('/vite.config.ts').map((config) => path.dirname(config));
}

/**
 * Build one app in check mode, loading its config with Node's own loader.
 *
 * @param {string} app - The app's directory.
 * @param {string} outDir - Where the build writes.
 * @param {string} cwd - The checkout the build runs in.
 * @returns {Finished} The finished build.
 */
function buildApp(app: string, outDir: string, cwd: string): Finished {
  return finished(
    [
      bin('vite'),
      'build',
      app,
      '--config',
      path.join(app, 'vite.config.ts'),
      '--mode',
      'check',
      '--outDir',
      outDir,
      '--emptyOutDir',
      '--configLoader',
      'native',
      '--logLevel',
      'warn',
    ],
    { cwd },
  );
}

/**
 * A file's content hash and modification time, so a rewrite with identical content still counts as a write.
 *
 * @param {string} full - The file's absolute path.
 * @returns {string | undefined} Its state, or undefined when it is no file.
 */
function fileState(full: string): string | undefined {
  const stat = existsSync(full) ? statSync(full) : undefined;
  if (stat?.isFile() !== true) {
    return undefined;
  }
  const content = createHash('sha256').update(readFileSync(full)).digest('hex');
  return `${content}@${stat.mtimeMs}`;
}

/**
 * The untracked and ignored files of a checkout (outside node_modules), each with its state.
 *
 * @param {string} root - The checkout.
 * @returns {ReadonlyMap<string, string>} Each file's state, by path.
 */
function checkoutState(root: string): ReadonlyMap<string, string> {
  const status = finished(
    [
      'git',
      'status',
      '--porcelain=v1',
      '-z',
      '--ignored',
      '--untracked-files=all',
      '--',
      '.',
      ':(exclude)**/node_modules/**',
      ':(exclude)node_modules/**',
    ],
    { cwd: root },
  );
  return new Map(
    status.stdout.split('\0').flatMap((entry) => {
      const listed = entry.slice(STATUS_WIDTH);
      const state = listed === '' ? undefined : fileState(path.join(root, listed));
      return state === undefined ? [] : [[listed, state] as const];
    }),
  );
}

/**
 * The paths a step created or changed between two checkout states.
 *
 * @param {Readonly<ReadonlyMap<string, string>>} before - The state before the step.
 * @param {Readonly<ReadonlyMap<string, string>>} after - The state after it.
 * @returns {readonly string[]} The written paths.
 */
function writes(before: Readonly<ReadonlyMap<string, string>>, after: Readonly<ReadonlyMap<string, string>>): readonly string[] {
  return [...after]
    .filter(([written, state]: readonly [string, string]) => before.get(written) !== state)
    .map(([written]: readonly [string, string]) => written);
}

/**
 * Build `app` of the checkout at `root` into a fresh temporary directory, watching for writes.
 *
 * @param {string} app - The app's directory.
 * @param {string} root - The checkout.
 * @returns {BuildResult} The build's result.
 */
function checkBuild(app: string, root: string = REPO_ROOT): BuildResult {
  const outDir = mkdtempSync(path.join(tmpdir(), 'build-check-'));
  try {
    const before = checkoutState(root);
    const built = buildApp(app, outDir, root);
    return {
      app,
      output: built.stdout + built.stderr,
      status: built.status,
      written: writes(before, checkoutState(root)),
    };
  } finally {
    rmSync(outDir, { force: true, recursive: true });
  }
}

export { apps, checkBuild };
