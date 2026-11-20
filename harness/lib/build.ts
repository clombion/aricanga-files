/**
 * The one owner of building the product from the gate: every held Vite app is built in `check`
 * mode into a temporary directory, and a build that writes into the checkout is a finding.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { Exemptions } from './exemptions.ts';
import { REPO_ROOT } from './paths.ts';
import type { Finished } from './process.ts';
import { heldFiles } from './scope.ts';
import { bin, finished } from './tools.ts';

/** Builds that write a file of the checkout, keyed by the path written. */
export const BUILD_WRITES = new Exemptions({
  'experiences/sandbox/public/story.json':
    'adopting: the compile-ink plugin emits story.json with this.emitFile instead of writing public/',
});

/** The held Vite apps: every held directory with a `vite.config.ts`. */
export function apps(): readonly string[] {
  return heldFiles('/vite.config.ts').map((path) => dirname(path));
}

/** Build one app in check mode into `outDir`, loading its config with Node's own loader. */
export function buildApp(app: string, outDir: string, cwd: string = REPO_ROOT): Finished {
  return finished(
    [
      bin('vite'),
      'build',
      app,
      '--config',
      join(app, 'vite.config.ts'),
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
 * The untracked and ignored files of a checkout (outside node_modules), each with its content hash
 * and modification time, so a rewrite with identical content still counts as a write.
 */
export function checkoutState(root: string): ReadonlyMap<string, string> {
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
  const state = new Map<string, string>();
  for (const entry of status.stdout.split('\0')) {
    const path = entry.slice(3);
    const full = join(root, path);
    const stat = path === '' || !existsSync(full) ? undefined : statSync(full);
    if (stat?.isFile() === true) {
      const content = createHash('sha256').update(readFileSync(full)).digest('hex');
      state.set(path, `${content}@${stat.mtimeMs}`);
    }
  }
  return state;
}

/** The paths a step created or changed between two checkout states. */
export function writes(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): readonly string[] {
  return [...after].filter(([path, hash]) => before.get(path) !== hash).map(([path]) => path);
}

/** One app's build: whether it succeeded, its output, and what it wrote into the checkout. */
export interface BuildResult {
  readonly app: string;
  readonly status: number;
  readonly output: string;
  readonly written: readonly string[];
}

/** Build `app` of the checkout at `root` into a fresh temporary directory, watching for writes. */
export function checkBuild(app: string, root: string = REPO_ROOT): BuildResult {
  const outDir = mkdtempSync(join(tmpdir(), 'build-check-'));
  try {
    const before = checkoutState(root);
    const built = buildApp(app, outDir, root);
    return {
      app,
      status: built.status,
      output: built.stdout + built.stderr,
      written: writes(before, checkoutState(root)),
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
