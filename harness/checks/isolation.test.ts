/**
 * A test that leaves a timer pending when it ends fails, and the next test starts clean.
 *
 * Planted through a Vitest run under the gate's guards: a pending timeout and a pending interval each
 * fail their test, naming the line that set them; a timer that fires within the test, a cleared
 * timer, and the test after a leaking one pass.
 */

import { describe, expect, test } from 'vitest';

import { runPlanted } from '../lib/planted-vitest.ts';

export const HARNESS_ID = 'isolation';

const PLANTED = `import { expect, test } from 'vitest';

test('a pending timeout fails', () => {
  setTimeout(() => undefined, 60_000);
  expect(1).toBe(1);
});

test('a pending interval fails', () => {
  setInterval(() => undefined, 60_000);
  expect(1).toBe(1);
});

test('a timer that fires passes', async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(1).toBe(1);
});

test('a cleared timer passes', () => {
  clearTimeout(setTimeout(() => undefined, 60_000));
  clearInterval(setInterval(() => undefined, 60_000));
  expect(1).toBe(1);
});

test('the test after a leak starts clean', () => {
  expect(1).toBe(1);
});
`;

describe('the guards, through a planted Vitest run', () => {
  test('fail a pending timeout and interval, and pass a fired, a cleared and a clean test', () => {
    const outcomes = runPlanted({ 'isolation.test.ts': PLANTED });
    expect([...outcomes].map(([name, outcome]) => [name, outcome.status])).toEqual([
      ['a pending timeout fails', 'failed'],
      ['a pending interval fails', 'failed'],
      ['a timer that fires passes', 'passed'],
      ['a cleared timer passes', 'passed'],
      ['the test after a leak starts clean', 'passed'],
    ]);
    expect(outcomes.get('a pending timeout fails')?.failure).toMatch(/left 1 timer\(s\) pending: timeout set at .*isolation\.test\.ts:4/);
    expect(outcomes.get('a pending interval fails')?.failure).toMatch(/interval set at .*isolation\.test\.ts:9/);
  });
});
