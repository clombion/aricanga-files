/** A patched function runs its replacement until restored, and only a function can be patched. */

import { describe, expect, test } from 'vitest';
import { patch } from '#lib/patch.ts';

/** What the planted function adds. */
const STEP = 1;

/** What the replacement adds on top of the real function. */
const EXTRA = 10;

/** The value the planted function is called with. */
const INPUT = 2;

describe('a patch', () => {
  test('runs the replacement, which may call the real function, until it is restored', () => {
    expect.hasAssertions();
    const target = {
      add(value: number): number {
        return value + STEP;
      },
    };
    const restore = patch(target, 'add', (real) => (self, args): number => Number(real(self, args)) + EXTRA);
    expect(target.add(INPUT)).toBe(INPUT + STEP + EXTRA);
    restore();
    expect(target.add(INPUT)).toBe(INPUT + STEP);
  });

  test('refuses a key that is not a function, naming it', () => {
    expect.hasAssertions();
    expect(() => patch({ planted: 1 }, 'planted', (real) => real)).toThrow(new TypeError('planted is not a function'));
  });
});
