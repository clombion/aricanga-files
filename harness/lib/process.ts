/**
 * The one owner of starting a child process. Every run is bounded, and its outcome is one of
 * three: it finished, it outlived its bound, or it could not start.
 */

import { spawnSync } from 'node:child_process';

export interface Finished {
  readonly kind: 'finished';
  readonly argv: readonly string[];
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface TimedOut {
  readonly kind: 'timed-out';
  readonly argv: readonly string[];
  readonly timeoutMs: number;
}

export interface NotStarted {
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
