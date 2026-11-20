/**
 * The one owner of starting a child process. Every run is bounded, and its outcome is one of
 * three: it finished, it outlived its bound, or it could not start.
 */

import { spawn, spawnSync } from 'node:child_process';

export interface Finished {
  readonly kind: 'finished';
  readonly argv: readonly string[];
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface TimedOut {
  readonly kind: 'timed-out';
  readonly argv: readonly string[];
  readonly timeoutMs: number;
}

interface NotStarted {
  readonly kind: 'not-started';
  readonly argv: readonly string[];
  readonly reason: string;
}

export type Outcome = Finished | TimedOut | NotStarted;

interface RunOptions {
  readonly timeoutMs: number;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
}

/** This process's environment: the one read of `process.env` in the harness. */
export function environment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return env;
}

/** Run one `argv` without blocking, to its end or its bound, never through a shell. */
 async function start(argv: readonly string[], options: RunOptions): Promise<Outcome> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.resolve({ argv, kind: 'not-started', reason: 'empty argv' });
  }
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ argv, kind: 'not-started', reason: error.message });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve(
        timedOut || status === null
          ? { argv, kind: 'timed-out', timeoutMs: options.timeoutMs }
          : { argv, kind: 'finished', status, stderr, stdout },
      );
    });
    child.stdin.end(options.input ?? '');
  });
}

/** Run every `argv` at once, each bounded on its own; the outcomes in the order given. */
export async function runConcurrently(argvs: readonly (readonly string[])[], options: RunOptions): Promise<Outcome[]> {
  return Promise.all(argvs.map( async (argv) => start(argv, options)));
}

/** Run `argv` to its end or its bound, never through a shell. */
export function run(argv: readonly string[], options: RunOptions): Outcome {
  const [command, ...args] = argv;
  if (command === undefined) {
    return { argv, kind: 'not-started', reason: 'empty argv' };
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? environment(),
    input: options.input,
    killSignal: 'SIGKILL',
    maxBuffer: 256 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
  if (result.error !== undefined) {
    if ('code' in result.error && result.error.code === 'ETIMEDOUT') {
      return { argv, kind: 'timed-out', timeoutMs: options.timeoutMs };
    }
    return { argv, kind: 'not-started', reason: result.error.message };
  }
  if (result.status === null) {
    return { argv, kind: 'timed-out', timeoutMs: options.timeoutMs };
  }
  return { argv, kind: 'finished', status: result.status, stderr: result.stderr, stdout: result.stdout };
}
