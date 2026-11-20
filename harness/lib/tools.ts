/**
 * Runs the project's locked tools from the checks, bounded, on the repository or on a planted
 * project: a throwaway tree holding copies of this repository's configuration, so a planted
 * violation meets the tools under the configuration the gate uses.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { fromRoot, REPO_ROOT } from './paths.ts';
import { environment, type Finished, run } from './process.ts';

/** The bound on one tool run from a check. */
const TIMEOUT_MS = 300_000;

class ToolError extends Error {
  override readonly name = 'ToolError';
}

/** This process's environment without the variables that tie a child run to this one. */
export function isolatedEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(environment()).filter(([name]) => !name.startsWith('VITEST') && !name.startsWith('NODE_V8_COVERAGE')),
  );
  return { ...env, ...extra };
}

/** Run a tool to its end, throwing if it could not start or outlived its bound. */
export function finished(
  argv: readonly string[],
  options: { readonly cwd: string; readonly env?: Readonly<Record<string, string>>; readonly input?: string },
): Finished {
  const outcome = run(argv, { timeoutMs: TIMEOUT_MS, env: options.env ?? isolatedEnv(), ...options });
  if (outcome.kind !== 'finished') {
    throw new ToolError(`${argv.join(' ')} did not finish: ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

/** The path of a locked tool's binary. */
export function bin(name: string): string {
  return fromRoot('node_modules', '.bin', name);
}

/**
 * A planted project: a temporary directory with copies of the named repository files and a link to
 * the repository's `node_modules`, so its tools resolve exactly as the gate's do.
 */
export class Project {
  readonly root: string;

  constructor(options: { readonly copies?: readonly string[]; readonly linkModules?: boolean } = {}) {
    this.root = mkdtempSync(join(tmpdir(), 'harness-plant-'));
    if (options.linkModules ?? true) {
      symlinkSync(join(REPO_ROOT, 'node_modules'), join(this.root, 'node_modules'), 'dir');
    }
    for (const path of options.copies ?? []) {
      mkdirSync(dirname(join(this.root, path)), { recursive: true });
      cpSync(join(REPO_ROOT, path), join(this.root, path), { recursive: true });
    }
  }

  /** Read a file of the planted project. */
  read(path: string): string {
    return readFileSync(join(this.root, path), 'utf8');
  }

  /** Write a file of the planted project. */
  write(path: string, text: string): string {
    const target = join(this.root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
    return target;
  }

  /** Run a locked tool of the repository in the planted project. */
  tool(name: string, ...args: string[]): Finished {
    return finished([bin(name), ...args], { cwd: this.root });
  }

  /** Run a command in the planted project. */
  run(...argv: string[]): Finished {
    return finished(argv, { cwd: this.root });
  }

  /** Run a command in the planted project with `input` on its standard input. */
  runWithInput(input: string, ...argv: string[]): Finished {
    return finished(argv, { cwd: this.root, input });
  }

  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
