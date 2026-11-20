import { describe, expect, test } from 'vitest';
import type { Lifecycle } from '#src/sim/input';
import { assertNever } from '#src/sim/exhaustive';

/** The seed of the `init` lifecycle the tests describe. */
const SEED = 2;

/**
 * An exhaustive switch over a closed union compiles and is total.
 *
 * @param {Lifecycle} lifecycle - The lifecycle input.
 * @returns {string} Its description.
 */
function describeLifecycle(lifecycle: Lifecycle): `init:${number}` | Lifecycle['kind'] {
  switch (lifecycle.kind) {
    case 'init': {
      return `init:${lifecycle.seed}`;
    }
    case 'reset': {
      return lifecycle.kind;
    }
    default: {
      return assertNever(lifecycle);
    }
  }
}

/**
 * Planted: a switch missing a case, so `@ts-expect-error` proves the compiler refuses it.
 *
 * @param {Lifecycle} lifecycle - The lifecycle input.
 * @returns {string} Its description, for the one case handled.
 */
function broken(lifecycle: Lifecycle): string {
  // oxlint-disable-next-line typescript/switch-exhaustiveness-check -- the planted missing case this test proves the compiler refuses
  switch (lifecycle.kind) {
    case 'init': {
      return `init:${lifecycle.seed}`;
    }
    // The case 'reset' is deliberately unhandled — `lifecycle` is still inhabited in `default`.
    default: {
      // @ts-expect-error -- `lifecycle` is `{kind:'reset'}` here, not `never`
      return assertNever(lifecycle);
    }
  }
}

describe('the exhaustiveness guard', () => {
  test('an exhaustive switch over a closed union compiles and runs', () => {
    expect.hasAssertions();
    expect(describeLifecycle({ kind: 'init', seed: SEED })).toBe(`init:${SEED}`);
    expect(describeLifecycle({ kind: 'reset' })).toBe('reset');
  });

  test('a non-exhaustive switch fails to compile (proven by @ts-expect-error)', () => {
    expect.hasAssertions();
    // The typed `init` path still works; the missed case is a compile-time error
    // (the @ts-expect-error above turns into a failure if exhaustiveness is added).
    expect(broken({ kind: 'init', seed: SEED })).toBe(`init:${SEED}`);
  });
});
