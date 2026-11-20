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

export interface RunOptions {
  readonly timeoutMs: number;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: string;
}

/** Run one `argv` without blocking, to its end or its bound, never through a shell. */
function start(argv: readonly string[], options: RunOptions): Promise<Outcome> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.resolve({ kind: 'not-started', argv, reason: 'empty argv' });
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
      resolve({ kind: 'not-started', argv, reason: error.message });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve(
        timedOut || status === null
          ? { kind: 'timed-out', argv, timeoutMs: options.timeoutMs }
          : { kind: 'finished', argv, status, stdout, stderr },
      );
    });
    child.stdin.end(options.input ?? '');
  });
}

/** Run every `argv` at once, each bounded on its own; the outcomes in the order given. */
export function runConcurrently(argvs: readonly (readonly string[])[], options: RunOptions): Promise<Outcome[]> {
  return Promise.all(argvs.map((argv) => start(argv, options)));
}

/** Run `argv` to its end or its bound, never through a shell. */
export function run(argv: readonly string[], options: RunOptions): Outcome {
  const [command, ...args] = argv;
  if (command === undefined) {
    return { kind: 'not-started', argv, reason: 'empty argv' };
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    input: options.input,
    timeout: options.timeoutMs,
    killSignal: 'SIGKILL',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    if ('code' in result.error && result.error.code === 'ETIMEDOUT') {
      return { kind: 'timed-out', argv, timeoutMs: options.timeoutMs };
    }
    return { kind: 'not-started', argv, reason: result.error.message };
  }
  if (result.status === null) {
    return { kind: 'timed-out', argv, timeoutMs: options.timeoutMs };
  }
  return { kind: 'finished', argv, status: result.status, stdout: result.stdout, stderr: result.stderr };
}
