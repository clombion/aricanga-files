/**
 * The one owner of building the product from the gate: every held Vite app is built in `check`
 * mode into a temporary directory, and a build that writes into the checkout is a finding.
 */

import { bin, finished } from './tools.ts';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import type { Finished } from './process.ts';
import { REPO_ROOT } from './paths.ts';
import { createHash } from 'node:crypto';
import { heldFiles } from './scope.ts';
import { isFile } from './source-files.ts';
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
 * @returns {Promise<readonly string[]>} The apps' directories.
 */
async function apps(): Promise<readonly string[]> {
  const configs = await heldFiles('/vite.config.ts');
  return configs.map((config) => path.dirname(config));
}

/**
 * Build one app in check mode, loading its config with Node's own loader.
 *
 * @param {string} app - The app's directory.
 * @param {string} outDir - Where the build writes.
 * @param {string} cwd - The checkout the build runs in.
 * @returns {Promise<Finished>} The finished build.
 */
async function buildApp(app: string, outDir: string, cwd: string): Promise<Finished> {
  const built = await finished(
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
  return built;
}

/**
 * A file's content hash and modification time, so a rewrite with identical content still counts as a write.
 *
 * @param {string} full - The file's absolute path.
 * @returns {Promise<string | undefined>} Its state, or undefined when it is no file.
 */
async function fileState(full: string): Promise<string | undefined> {
  if (!(await isFile(path.dirname(full), path.basename(full)))) {
    return undefined;
  }
  const found = await stat(full);
  const bytes = await readFile(full);
  const content = createHash('sha256').update(bytes).digest('hex');
  return `${content}@${found.mtimeMs}`;
}

/**
 * The untracked and ignored files of a checkout (outside node_modules), each with its state.
 *
 * @param {string} root - The checkout.
 * @returns {Promise<ReadonlyMap<string, string>>} Each file's state, by path.
 */
async function checkoutState(root: string): Promise<ReadonlyMap<string, string>> {
  const status = await finished(
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
  const listed = status.stdout
    .split('\0')
    .map((entry) => entry.slice(STATUS_WIDTH))
    .filter((entry) => entry !== '');
  const states = await Promise.all(
    listed.map(async (entry) => {
      const state = await fileState(path.join(root, entry));
      return state;
    }),
  );
  return new Map(listed.flatMap((entry, index) => {
    const state = states[index];
    return state === undefined ? [] : [[entry, state] as const];
  }));
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
 * @returns {Promise<BuildResult>} The build's result.
 */
async function checkBuild(app: string, root: string = REPO_ROOT): Promise<BuildResult> {
  const outDir = await mkdtemp(path.join(tmpdir(), 'build-check-'));
  try {
    const before = await checkoutState(root);
    const built = await buildApp(app, outDir, root);
    const after = await checkoutState(root);
    return {
      app,
      output: built.stdout + built.stderr,
      status: built.status,
      written: writes(before, after),
    };
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
}

export { apps, checkBuild };
