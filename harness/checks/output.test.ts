/** The scripts' writes reach their sink as given or as a line, and a run's exit code follows its result. */

import { EXIT_FAILURE, EXIT_SUCCESS, complain, err, exitCode, out, say, standardInput } from '#lib/output.ts';
import { describe, expect, test, vi } from 'vitest';
import { STDIN } from './scripts.run.ts';
import type { Sink } from '#lib/output.ts';
import { text } from 'node:stream/consumers';

vi.mock(import('node:stream/consumers'), async (original) => {
  const consumers = await original();
  const { stoodInput } = await import('./scripts.run.ts');
  return { ...consumers, text: vi.fn<typeof consumers.text>(stoodInput) };
});

/**
 * A sink that keeps what is written to it.
 *
 * @returns {{ sink: Sink; written: string[] }} The sink and what it was given, in order.
 */
function keeping(): { readonly sink: Sink; readonly written: string[] } {
  const written: string[] = [];
  return {
    sink: {
      write: (chunk: unknown): boolean => {
        written.push(String(chunk));
        return true;
      },
    },
    written,
  };
}

describe("the scripts' output", () => {
  test('writes a result as given and as a line', () => {
    expect.hasAssertions();
    const { sink, written } = keeping();
    out('a', sink);
    say('b', sink);
    expect(written).toStrictEqual(['a', 'b\n']);
  });

  test('writes a failure as given and as a line', () => {
    expect.hasAssertions();
    const { sink, written } = keeping();
    err('c', sink);
    complain('d', sink);
    expect(written).toStrictEqual(['c', 'd\n']);
  });

  test('ends a run that passed with success and one that did not with failure', () => {
    expect.hasAssertions();
    expect(exitCode(true)).toBe(EXIT_SUCCESS);
    expect(exitCode(false)).toBe(EXIT_FAILURE);
  });

  test('reads standard input to its end', async () => {
    expect.hasAssertions();
    await expect(standardInput()).resolves.toBe(STDIN);
    expect(text).toHaveBeenCalledWith(process.stdin);
  });
});
