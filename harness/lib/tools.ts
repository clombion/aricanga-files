/**
 * Runs the project's locked tools from the checks, bounded, on the repository or on a planted
 * project: a throwaway tree holding copies of this repository's configuration, so a planted
 * violation meets the tools under the configuration the gate uses.
 */

import { REPO_ROOT, fromRoot } from './paths.ts';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { environment, run } from './process.ts';
import type { Finished } from './process.ts';
import { Prefixes } from './exemptions.ts';
import { ToolError } from './tool-error.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

/** The bound on one tool run from a check. */
const TIMEOUT_MS = 300_000;

/** The variables that tie a child run to this one. */
const TIED_PREFIXES = new Prefixes(['VITEST', 'NODE_V8_COVERAGE']);

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
  const env = Object.fromEntries(Object.entries(environment()).filter(([name]: readonly [string, string]) => !TIED_PREFIXES.starts(name)));
  return { ...env, ...extra };
}

/**
 * Run a tool to its end, throwing if it could not start or outlived its bound.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {ToolOptions} options - Where it runs and what it reads; the environment defaults to `isolatedEnv()`.
 * @returns {Promise<Finished>} The finished run.
 */
async function finished(argv: readonly string[], options: ToolOptions): Promise<Finished> {
  const outcome = await run(argv, { env: options.env ?? isolatedEnv(), timeoutMs: TIMEOUT_MS, ...options });
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
   * Hold a planted project's directory; `Project.create` makes one.
   *
   * @param {string} root - The project's directory.
   */
  private constructor(root: string) {
    this.root = root;
  }

  /**
   * Make a planted project.
   *
   * @param {ProjectOptions} options - What it copies and whether it links `node_modules`.
   * @returns {Promise<Project>} The project.
   */
  public static async create(options: ProjectOptions = {}): Promise<Project> {
    const root = await mkdtemp(path.join(tmpdir(), 'harness-plant-'));
    if (options.linkModules ?? true) {
      await symlink(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    }
    await Promise.all(
      (options.copies ?? []).map(async (copied) => {
        await mkdir(path.dirname(path.join(root, copied)), { recursive: true });
        await cp(path.join(REPO_ROOT, copied), path.join(root, copied), { recursive: true });
      }),
    );
    return new Project(root);
  }

  /**
   * Read a file of the planted project.
   *
   * @param {string} file - The file's path in the project.
   * @returns {Promise<string>} Its text.
   */
  public async read(file: string): Promise<string> {
    const text = await readFile(path.join(this.root, file), 'utf8');
    return text;
  }

  /**
   * Write a file of the planted project.
   *
   * @param {string} file - The file's path in the project.
   * @param {string} text - Its text.
   * @returns {Promise<string>} The file's absolute path.
   */
  public async write(file: string, text: string): Promise<string> {
    const target = path.join(this.root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text, 'utf8');
    return target;
  }

  /**
   * Write several files of the planted project at once.
   *
   * @param {Iterable<readonly [string, string]>} files - Each file's path in the project and its text.
   * @returns {Promise<void>} Settles once every file is written.
   */
  public async writeAll(files: Iterable<readonly [string, string]>): Promise<void> {
    await Promise.all(
      [...files].map(async ([file, text]: readonly [string, string]) => {
        await this.write(file, text);
      }),
    );
  }

  /**
   * Run a locked tool of the repository in the planted project.
   *
   * @param {string} name - The tool's binary name.
   * @param {readonly string[]} args - Its arguments.
   * @returns {Promise<Finished>} The finished run.
   */
  public async tool(name: string, ...args: readonly string[]): Promise<Finished> {
    const done = await finished([bin(name), ...args], { cwd: this.root });
    return done;
  }

  /**
   * Run a command in the planted project.
   *
   * @param {readonly string[]} argv - The command and its arguments.
   * @returns {Promise<Finished>} The finished run.
   */
  public async run(...argv: readonly string[]): Promise<Finished> {
    const done = await finished(argv, { cwd: this.root });
    return done;
  }

  /**
   * Run a command in the planted project with `input` on its standard input.
   *
   * @param {string} input - The command's standard input.
   * @param {readonly string[]} argv - The command and its arguments.
   * @returns {Promise<Finished>} The finished run.
   */
  public async runWithInput(input: string, ...argv: readonly string[]): Promise<Finished> {
    const done = await finished(argv, { cwd: this.root, input });
    return done;
  }

  /**
   * Delete the planted project.
   *
   * @returns {Promise<void>} Settles once it is deleted.
   */
  public async remove(): Promise<void> {
    await rm(this.root, { force: true, recursive: true });
  }
}

export { ToolError } from './tool-error.ts';
export { bin, finished, isolatedEnv, Project };
