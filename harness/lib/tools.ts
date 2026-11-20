/**
 * Runs the project's locked tools from the checks, bounded, on the repository or on a planted
 * project: a throwaway tree holding copies of this repository's configuration, so a planted
 * violation meets the tools under the configuration the gate uses.
 */

import { REPO_ROOT, fromRoot } from './paths.ts';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { environment, run } from './process.ts';
import type { Finished } from './process.ts';
import { ToolError } from './tool-error.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

/** The bound on one tool run from a check. */
const TIMEOUT_MS = 300_000;

/** The variables that tie a child run to this one. */
const TIED_PREFIXES: readonly string[] = ['VITEST', 'NODE_V8_COVERAGE'];

/** Where a tool runs, and what it reads. */
interface ToolOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
}

/** What a planted project holds besides its plants. */
interface ProjectOptions {
  /** Repository files and directories copied into the project. */
  readonly copies?: readonly string[];
  /** Whether the project links the repository's `node_modules`; it does unless told not to. */
  readonly linkModules?: boolean;
}

/**
 * This process's environment without the variables that tie a child run to this one.
 *
 * @param {Readonly<Record<string, string>>} extra - Variables to add or override.
 * @returns {Record<string, string>} The environment for a child run.
 */
function isolatedEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(environment()).filter(
      ([name]: readonly [string, string]) => !TIED_PREFIXES.some((prefix) => name.startsWith(prefix)),
    ),
  );
  return { ...env, ...extra };
}

/**
 * Run a tool to its end, throwing if it could not start or outlived its bound.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {ToolOptions} options - Where it runs and what it reads; the environment defaults to `isolatedEnv()`.
 * @returns {Finished} The finished run.
 */
function finished(argv: readonly string[], options: ToolOptions): Finished {
  const outcome = run(argv, { env: options.env ?? isolatedEnv(), timeoutMs: TIMEOUT_MS, ...options });
  if (outcome.kind !== 'finished') {
    throw new ToolError(`${argv.join(' ')} did not finish: ${JSON.stringify(outcome)}`);
  }
  return outcome;
}

/**
 * The path of a locked tool's binary.
 *
 * @param {string} name - The tool's binary name.
 * @returns {string} Its path under `node_modules/.bin`.
 */
function bin(name: string): string {
  return fromRoot('node_modules', '.bin', name);
}

/**
 * A planted project: a temporary directory with copies of the named repository files and a link to
 * the repository's `node_modules`, so its tools resolve exactly as the gate's do.
 */
class Project {
  public readonly root: string;

  /**
   * Make a planted project.
   *
   * @param {ProjectOptions} options - What it copies and whether it links `node_modules`.
   */
  public constructor(options: ProjectOptions = {}) {
    this.root = mkdtempSync(path.join(tmpdir(), 'harness-plant-'));
    if (options.linkModules ?? true) {
      symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(this.root, 'node_modules'), 'dir');
    }
    for (const copied of options.copies ?? []) {
      mkdirSync(path.dirname(path.join(this.root, copied)), { recursive: true });
      cpSync(path.join(REPO_ROOT, copied), path.join(this.root, copied), { recursive: true });
    }
  }

  /**
   * Read a file of the planted project.
   *
   * @param {string} file - The file's path in the project.
   * @returns {string} Its text.
   */
  public read(file: string): string {
    return readFileSync(path.join(this.root, file), 'utf8');
  }

  /**
   * Write a file of the planted project.
   *
   * @param {string} file - The file's path in the project.
   * @param {string} text - Its text.
   * @returns {string} The file's absolute path.
   */
  public write(file: string, text: string): string {
    const target = path.join(this.root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
    return target;
  }

  /**
   * Run a locked tool of the repository in the planted project.
   *
   * @param {string} name - The tool's binary name.
   * @param {readonly string[]} args - Its arguments.
   * @returns {Finished} The finished run.
   */
  public tool(name: string, ...args: readonly string[]): Finished {
    return finished([bin(name), ...args], { cwd: this.root });
  }

  /**
   * Run a command in the planted project.
   *
   * @param {readonly string[]} argv - The command and its arguments.
   * @returns {Finished} The finished run.
   */
  public run(...argv: readonly string[]): Finished {
    return finished(argv, { cwd: this.root });
  }

  /**
   * Run a command in the planted project with `input` on its standard input.
   *
   * @param {string} input - The command's standard input.
   * @param {readonly string[]} argv - The command and its arguments.
   * @returns {Finished} The finished run.
   */
  public runWithInput(input: string, ...argv: readonly string[]): Finished {
    return finished(argv, { cwd: this.root, input });
  }

  /** Delete the planted project. */
  public remove(): void {
    rmSync(this.root, { force: true, recursive: true });
  }
}

export { bin, finished, isolatedEnv, Project };
export type { ProjectOptions, ToolOptions };
